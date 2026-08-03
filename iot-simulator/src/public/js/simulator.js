document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const canvasContent = document.getElementById('canvas-content');
  const svgOverlay = document.getElementById('svg-overlay');
  
  // Overlay Config UI
  const controlOverlay = document.getElementById('control-overlay');
  const closeOverlay = document.getElementById('close-overlay');
  const overlayDeviceTitle = document.getElementById('overlay-device-title');
  const overlayApprovalBadge = document.getElementById('overlay-approval-badge');
  const configForm = document.getElementById('device-config-form');
  
  // Config Inputs
  const overlayDevId = document.getElementById('overlay-dev-id');
  const overlayDevName = document.getElementById('overlay-dev-name');
  const overlayDevIp = document.getElementById('overlay-dev-ip');
  const overlayDevMac = document.getElementById('overlay-dev-mac');
  const overlayDevZone = document.getElementById('overlay-dev-zone');
  const overlayDevInterval = document.getElementById('overlay-dev-interval');
  
  const powerSwitch = document.getElementById('power-switch');
  const metricsView = document.getElementById('metrics-view');
  const networkStatusView = document.getElementById('overlay-network-status');
  const connectedWiresView = document.getElementById('connected-wires-view');
  const incidentsSection = document.getElementById('overlay-incidents-section');
  const mitigateActionsContainer = document.getElementById('mitigate-actions-container');
  const deleteDeviceBtn = document.getElementById('delete-device-btn');
  
  // Zone list UI
  const zoneListContainer = document.getElementById('zone-list');
  const newZoneInput = document.getElementById('new-zone-input');
  const addZoneBtn = document.getElementById('add-zone-btn');

  // Terminal UI
  const terminal = document.getElementById('terminal');
  const terminalTitle = document.getElementById('terminal-title');

  // Zoom & Pan State
  let zoom = 1.0;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;

  // Connection Drag State
  let isDrawingWire = false;
  let wireFromId = null;
  let tempWirePath = null;
  let wireStartX = 0;
  let wireStartY = 0;

  let selectedNodeId = null;
  let devicesData = [];
  let connectionsData = [];
  let zonesData = [];
  let devicePositions = JSON.parse(localStorage.getItem('device_positions') || '{}');
  let activeZoneFilter = 'ALL';
  const zoneFilterTabs = document.getElementById('zone-filter-tabs');
  let isFirstLoad = true;

  // 1. Accordion logic
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  accordionHeaders.forEach(h => {
    h.addEventListener('click', () => {
      const item = h.parentElement;
      item.classList.toggle('open');
    });
  });

  // 2. Zoom & Pan implementation
  function updateCanvasTransform() {
    canvasContent.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }

  canvas.addEventListener('mousedown', (e) => {
    // If click is not on a node or port, trigger panning
    if (!e.target.closest('.node-element') && !e.target.closest('.network-port')) {
      isPanning = true;
      canvas.style.cursor = 'grabbing';
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isPanning) {
      panX = e.clientX - startPanX;
      panY = e.clientY - startPanY;
      updateCanvasTransform();
    }
  });

  document.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = 'grab';
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    zoom = Math.max(0.4, Math.min(2.5, zoom + delta));
    updateCanvasTransform();
  });

  // HUD zoom clicks
  document.getElementById('zoom-in-btn').addEventListener('click', () => {
    zoom = Math.min(2.5, zoom + 0.15);
    updateCanvasTransform();
  });
  document.getElementById('zoom-out-btn').addEventListener('click', () => {
    zoom = Math.max(0.4, zoom - 0.15);
    updateCanvasTransform();
  });
  document.getElementById('zoom-reset-btn').addEventListener('click', () => {
    zoom = 1.0;
    panX = 0;
    panY = 0;
    updateCanvasTransform();
  });

  // 3. Drag-and-drop templates
  const templates = document.querySelectorAll('.device-template');
  templates.forEach(t => {
    t.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('device-type', t.dataset.type);
    });
  });

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  canvas.addEventListener('drop', async (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('device-type');
    if (!type) return;

    const rect = canvas.getBoundingClientRect();
    // Mathematical zoom/pan projection formula
    const x = (e.clientX - rect.left - panX) / zoom - 60;
    const y = (e.clientY - rect.top - panY) / zoom - 35;

    const devId = prompt(`Nhap ma thiet bi (ID) duy nhat cho ${type}:`, `${type.toLowerCase()}-${Math.floor(100 + Math.random() * 900)}`);
    if (!devId) return;

    const cleanId = devId.trim().toLowerCase().replace(/\s+/g, '-');
    const devName = prompt(`Nhap ten thiet bi:`, `Mop phong ${type} ${cleanId}`);
    if (!devName) return;

    // Use first zone as default
    const zone = zonesData[0] || 'Zone-A';

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id: cleanId, name: devName, zone })
      });
      const resData = await response.json();
      if (resData.error) {
        alert(`Loi: ${resData.error}`);
        return;
      }

      devicePositions[cleanId] = { x, y };
      savePositions();
      
      // Save position to server
      await fetch(`/api/devices/${cleanId}/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y })
      });
      
      selectedNodeId = cleanId;
      fetchAndRender();
    } catch (err) {
      console.error(err);
    }
  });

  // 4. Zone management actions
  addZoneBtn.addEventListener('click', async () => {
    const name = newZoneInput.value.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        newZoneInput.value = '';
        fetchAndRender();
      }
    } catch (err) {
      console.error(err);
    }
  });

  async function deleteZone(name) {
    if (confirm(`Ban co muon xoa Zone ${name}? Cac thiet bi thuoc zone nay se duoc dua ve 'Unassigned'.`)) {
      await fetch(`/api/zones/${name}`, { method: 'DELETE' });
      fetchAndRender();
    }
  }

  // 5. Config overlay form submit
  configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedNodeId) return;

    const payload = {
      name: overlayDevName.value,
      ipAddress: overlayDevIp.value,
      macAddress: overlayDevMac.value,
      zone: overlayDevZone.value,
      intervalMs: overlayDevInterval.value
    };

    await fetch(`/api/devices/${selectedNodeId}/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    fetchAndRender();
  });

  // Close overlay control
  closeOverlay.addEventListener('click', () => {
    selectedNodeId = null;
    controlOverlay.style.display = 'none';
    document.querySelectorAll('.node-element').forEach(n => n.classList.remove('selected'));
    updateTerminal();
  });

  // Power Switch action
  powerSwitch.addEventListener('change', async () => {
    if (!selectedNodeId) return;
    await fetch(`/api/devices/${selectedNodeId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ power: powerSwitch.checked })
    });
    fetchAndRender();
  });

  // Delete device
  deleteDeviceBtn.addEventListener('click', async () => {
    if (!selectedNodeId) return;
    if (confirm(`Ban co muon xoa vinh vien thiet bi ${selectedNodeId} khoi he thong?`)) {
      await fetch(`/api/devices/${selectedNodeId}`, { method: 'DELETE' });
      delete devicePositions[selectedNodeId];
      savePositions();
      selectedNodeId = null;
      controlOverlay.style.display = 'none';
      fetchAndRender();
    }
  });

  function savePositions() {
    localStorage.setItem('device_positions', JSON.stringify(devicePositions));
  }

  // 6. Port wire dragging logic
  document.addEventListener('mousemove', (e) => {
    if (isDrawingWire && tempWirePath) {
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - canvasRect.left - panX) / zoom;
      const mouseY = (e.clientY - canvasRect.top - panY) / zoom;

      // Bezier curve mapping
      const dx = mouseX - wireStartX;
      const dy = mouseY - wireStartY;
      const cx = wireStartX + dx / 2;
      const cy = wireStartY + dy / 2 - (dy > 0 ? 30 : -30);

      tempWirePath.setAttribute('d', `M ${wireStartX} ${wireStartY} Q ${cx} ${cy} ${mouseX} ${mouseY}`);
    }
  });

  document.addEventListener('mouseup', async (e) => {
    if (isDrawingWire) {
      isDrawingWire = false;
      if (tempWirePath) {
        tempWirePath.remove();
        tempWirePath = null;
      }

      // Check drop target port
      const targetEl = document.elementFromPoint(e.clientX, e.clientY);
      if (targetEl) {
        const targetPort = targetEl.closest('.network-port');
        if (targetPort) {
          const wireToId = targetPort.dataset.id;
          
          if (wireToId === wireFromId) {
            alert('Không thể tự kết nối thiết bị với chính nó!');
            return;
          }
          
          if (wireToId) {
            // 1. Check if connection already exists
            const exists = connectionsData.some(c => (c.from === wireFromId && c.to === wireToId) || (c.from === wireToId && c.to === wireFromId));
            if (exists) {
              alert('Kết nối này đã tồn tại!');
              return;
            }

            // 2. Check connection limits for end-devices (non-Gateways can only have 1 wire)
            const getDeviceType = (id) => {
              const d = devicesData.find(x => x.id === id);
              return d ? d.type : null;
            };
            const isEndDevice = (id) => {
              const t = getDeviceType(id);
              return t && t !== 'GATEWAY';
            };
            const countConns = (id) => {
              return connectionsData.filter(c => c.from === id || c.to === id).length;
            };

            if (isEndDevice(wireFromId) && countConns(wireFromId) >= 1) {
              alert(`Thiết bị [${wireFromId}] đã có kết nối mạng. Mỗi thiết bị công nghiệp chỉ có 1 cổng mạng!`);
              return;
            }
            if (isEndDevice(wireToId) && countConns(wireToId) >= 1) {
              alert(`Thiết bị [${wireToId}] đã có kết nối mạng. Mỗi thiết bị công nghiệp chỉ có 1 cổng mạng!`);
              return;
            }

            // Save link connection
            await fetch('/api/connections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: wireFromId, to: wireToId })
            });
            fetchAndRender();
          }
        }
      }
    }
  });

  async function removeWire(from, to) {
    if (confirm(`Rut day cap ket noi mang giua ${from} va ${to}?`)) {
      await fetch('/api/connections/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to })
      });
      fetchAndRender();
    }
  }

  // 7. Render loops
  async function fetchAndRender() {
    try {
      // 1. Fetch Zones
      const zRes = await fetch('/api/zones');
      zonesData = await zRes.json();
      renderZonesList();
 
      // 2. Fetch Connections
      const cRes = await fetch('/api/connections');
      connectionsData = await cRes.json();
 
      // 3. Fetch Devices
      const dRes = await fetch('/api/devices');
      devicesData = await dRes.json();
 
      if (isFirstLoad) {
        isFirstLoad = false;
        if (detectAnyOverlap(devicesData)) {
          await performAutoLayout();
        }
      }

      renderNodes();
      renderConnections();
      renderDetailsPane();
      updateTerminal();
    } catch (err) {
      console.error(err);
    }
  }

  function detectAnyOverlap(devices) {
    for (let i = 0; i < devices.length; i++) {
      for (let j = i + 1; j < devices.length; j++) {
        const d1 = devices[i];
        const d2 = devices[j];
        
        const x1 = d1.x !== undefined ? d1.x : (devicePositions[d1.id] ? devicePositions[d1.id].x : 0);
        const y1 = d1.y !== undefined ? d1.y : (devicePositions[d1.id] ? devicePositions[d1.id].y : 0);
        const x2 = d2.x !== undefined ? d2.x : (devicePositions[d2.id] ? devicePositions[d2.id].x : 0);
        const y2 = d2.y !== undefined ? d2.y : (devicePositions[d2.id] ? devicePositions[d2.id].y : 0);

        if ((x1 === 0 && y1 === 0) || (x2 === 0 && y2 === 0)) {
          return true;
        }

        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        if (dx < 135 && dy < 90) {
          return true;
        }
      }
    }
    return false;
  }

  async function performAutoLayout() {
    console.log("Auto-arranging network scientifically to resolve overlaps...");
    const zoneGroups = {};
    zonesData.forEach(z => { zoneGroups[z] = []; });
    zoneGroups['Unassigned'] = [];

    devicesData.forEach(d => {
      const z = d.zone || 'Unassigned';
      if (!zoneGroups[z]) zoneGroups[z] = [];
      zoneGroups[z].push(d);
    });

    const activeZones = Object.keys(zoneGroups).filter(z => zoneGroups[z].length > 0);
    
    for (let zoneIdx = 0; zoneIdx < activeZones.length; zoneIdx++) {
      const zoneName = activeZones[zoneIdx];
      const zoneDevs = zoneGroups[zoneName];
      const xOffset = 100 + zoneIdx * 1250;

      const cols = { 0: [], 1: [], 2: [], 3: [], 4: [] };
      zoneDevs.forEach(d => {
        if (d.type === 'GATEWAY') {
          cols[0].push(d);
        } else if (d.type === 'PLC' || d.type === 'HMI' || d.type === 'CHIP') {
          cols[1].push(d);
        } else if (d.type === 'SENSOR') {
          cols[2].push(d);
        } else if (d.type === 'ACTUATOR' || d.type === 'FIRE_ALARM') {
          cols[3].push(d);
        } else {
          cols[4].push(d);
        }
      });

      const colX = [0, 220, 480, 740, 980];
      for (let col = 0; col < 5; col++) {
        const colDevs = cols[col];
        colDevs.forEach((d, rowIdx) => {
          const posX = xOffset + colX[col];
          const posY = 120 + rowIdx * 95;

          devicePositions[d.id] = { x: posX, y: posY };
          d.x = posX;
          d.y = posY;
        });
      }
    }

    savePositions();

    for (const d of devicesData) {
      fetch(`/api/devices/${d.id}/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: devicePositions[d.id].x, y: devicePositions[d.id].y })
      }).catch(err => console.error(err));
    }
  }

  function renderZonesList() {
    zoneListContainer.innerHTML = '';
    
    // Fill Config panel select
    const currentSelVal = overlayDevZone.value;
    overlayDevZone.innerHTML = '';

    // Render Zone Filter Tabs
    zoneFilterTabs.innerHTML = '';
    
    // Add "All" Tab
    const allTab = document.createElement('button');
    allTab.className = `zone-tab-btn ${activeZoneFilter === 'ALL' ? 'active' : ''}`;
    allTab.innerText = 'TẤT CẢ';
    allTab.addEventListener('click', () => {
      activeZoneFilter = 'ALL';
      fetchAndRender();
    });
    zoneFilterTabs.appendChild(allTab);

    zonesData.forEach(name => {
      const div = document.createElement('div');
      div.className = 'zone-manager-item';
      div.innerHTML = `
        <span>${name}</span>
        <button class="zone-del-btn" data-name="${name}">&times;</button>
      `;
      div.querySelector('.zone-del-btn').addEventListener('click', () => deleteZone(name));
      zoneListContainer.appendChild(div);

      // Populate select option
      const opt = document.createElement('option');
      opt.value = name;
      opt.innerText = name;
      overlayDevZone.appendChild(opt);

      // Add to Zone Filter Tabs
      const tab = document.createElement('button');
      tab.className = `zone-tab-btn ${activeZoneFilter === name ? 'active' : ''}`;
      tab.innerText = name.toUpperCase();
      tab.addEventListener('click', () => {
        activeZoneFilter = name;
        fetchAndRender();
      });
      zoneFilterTabs.appendChild(tab);
    });

    if (currentSelVal) overlayDevZone.value = currentSelVal;
  }

  function avoidOverlap(id, x, y, devices, devicePositions) {
    let currentX = Math.round(x);
    let currentY = Math.round(y);
    let foundOverlap = true;
    let attempts = 0;
    
    while (foundOverlap && attempts < 150) {
      foundOverlap = false;
      for (const dev of devices) {
        if (dev.id === id) continue;
        const pos = devicePositions[dev.id];
        if (!pos) continue;
        
        const dx = Math.abs(currentX - pos.x);
        const dy = Math.abs(currentY - pos.y);
        
        if (dx < 135 && dy < 90) {
          foundOverlap = true;
          currentY += 90;
          if (currentY > 1000) {
            currentY = y;
            currentX += 135;
          }
          break;
        }
      }
      attempts++;
    }
    return { x: currentX, y: currentY };
  }

  function getZoneColor(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('a')) {
      return { border: 'rgba(0, 243, 255, 0.45)', bg: 'rgba(0, 243, 255, 0.008)', text: 'var(--neon-cyan)' };
    }
    if (nameLower.includes('b')) {
      return { border: 'rgba(255, 159, 0, 0.45)', bg: 'rgba(255, 159, 0, 0.008)', text: 'var(--neon-orange)' };
    }
    if (nameLower.includes('c')) {
      return { border: 'rgba(57, 255, 20, 0.45)', bg: 'rgba(57, 255, 20, 0.008)', text: 'var(--neon-green)' };
    }
    return { border: 'rgba(138, 43, 226, 0.45)', bg: 'rgba(138, 43, 226, 0.008)', text: '#8a2be2' };
  }

  function renderNodes() {
    const nodes = canvasContent.querySelectorAll('.node-element');
    nodes.forEach(n => n.remove());

    const oldBoxes = canvasContent.querySelectorAll('.zone-boundary-box');
    oldBoxes.forEach(b => b.remove());

    if (activeZoneFilter === 'ALL') {
      zonesData.forEach(zoneName => {
        const zoneDevices = devicesData.filter(d => d.zone === zoneName);
        if (zoneDevices.length === 0) return;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let hasPositions = false;

        zoneDevices.forEach(d => {
          const pos = devicePositions[d.id];
          if (pos) {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x + 120);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y + 70);
            hasPositions = true;
          }
        });

        if (hasPositions) {
          const pad = 40;
          const boxX = minX - pad;
          const boxY = minY - pad - 20;
          const boxW = (maxX - minX) + pad * 2;
          const boxH = (maxY - minY) + pad * 2 + 20;

          const box = document.createElement('div');
          box.className = 'zone-boundary-box';
          box.style.left = `${boxX}px`;
          box.style.top = `${boxY}px`;
          box.style.width = `${boxW}px`;
          box.style.height = `${boxH}px`;

          const colors = getZoneColor(zoneName);
          box.style.border = `2px dashed ${colors.border}`;
          box.style.background = colors.bg;

          const label = document.createElement('div');
          label.className = 'zone-boundary-label';
          label.innerText = `PHÂN VÙNG: ${zoneName.toUpperCase()}`;
          label.style.color = colors.text;
          box.appendChild(label);

          canvasContent.appendChild(box);
        }
      });
    }

    const filteredDevices = activeZoneFilter === 'ALL'
      ? devicesData
      : devicesData.filter(d => d.zone === activeZoneFilter);

    filteredDevices.forEach(d => {
      const hasServerPos = (d.x !== undefined && d.y !== undefined && (d.x !== 0 || d.y !== 0));
      if (!devicePositions[d.id]) {
        devicePositions[d.id] = {
          x: hasServerPos ? d.x : (150 + Math.random() * 250),
          y: hasServerPos ? d.y : (100 + Math.random() * 200)
        };
        savePositions();
      } else if (hasServerPos) {
        devicePositions[d.id].x = d.x;
        devicePositions[d.id].y = d.y;
      }
      const pos = devicePositions[d.id];

      const node = document.createElement('div');
      node.className = 'node-element';
      node.id = `node-${d.id}`;
      node.style.left = `${pos.x}px`;
      node.style.top = `${pos.y}px`;

      // Apply CSS classes
      const isOnline = d.isPowerConnected;
      const isApproved = d.approvalStatus === 'APPROVED';
      const underAttack = d.activeAttacks.length > 0;

      if (!isOnline) node.classList.add('offline');
      else if (!isApproved) node.classList.add('pending');
      else if (!d.isNetworkConnected) node.classList.add('isolated');
      else if (underAttack) node.classList.add('under-attack');

      if (d.id === selectedNodeId) node.classList.add('selected');

      // Status indicator dot
      let statusDotClass = 'active';
      if (!isOnline) statusDotClass = 'offline';
      else if (!isApproved) statusDotClass = 'pending';
      else if (!d.isNetworkConnected) statusDotClass = 'isolated';
      else if (underAttack) statusDotClass = 'attack';

      // Type icons
      let icon = '⚙️';
      if (d.type === 'PLC') icon = '🎛️';
      else if (d.type === 'HMI') icon = '🖥️';
      else if (d.type === 'SENSOR') icon = '🌡️';
      else if (d.type === 'GATEWAY') icon = '🔌';
      else if (d.type === 'ACTUATOR') icon = '⚙️';
      else if (d.type === 'IP_CAMERA') icon = '📹';
      else if (d.type === 'SMART_METER') icon = '⚡';
      else if (d.type === 'FIRE_ALARM') icon = '🚨';
      else if (d.type === 'CHIP') icon = '💾';

      node.innerHTML = `
        <div class="node-icon">${icon}</div>
        <div class="node-label" title="${d.name}">${d.name}</div>
        <div style="font-size:0.65rem;color:var(--text-secondary);display:flex;align-items:center;justify-content:center;margin-top:0.2rem;">
          <span class="node-status-dot ${statusDotClass}"></span>
          <span>${d.id}</span>
        </div>
        <!-- network port handle -->
        <div class="network-port" data-id="${d.id}" title="Click va keo de noi cap mang"></div>
      `;

      // Wire dragging from port trigger
      const port = node.querySelector('.network-port');
      port.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        isDrawingWire = true;
        wireFromId = d.id;
        
        // Connectors middle coordinate mapping
        wireStartX = pos.x + 120;
        wireStartY = pos.y + 35;

        tempWirePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempWirePath.setAttribute('id', 'temp-wire-path');
        tempWirePath.setAttribute('class', 'cable-path');
        tempWirePath.setAttribute('d', `M ${wireStartX} ${wireStartY} L ${wireStartX} ${wireStartY}`);
        svgOverlay.appendChild(tempWirePath);
      });

      // Drag node logic with zoom scaling check
      node.addEventListener('mousedown', (e) => {
        if (e.target.closest('.network-port')) return;
        e.stopPropagation();

        selectedNodeId = d.id;
        document.querySelectorAll('.node-element').forEach(n => n.classList.remove('selected'));
        node.classList.add('selected');
        renderDetailsPane();
        updateTerminal();

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startNodeX = pos.x;
        const startNodeY = pos.y;

        function onMouseMove(moveEvt) {
          // Coordinate tracking divided by zoom factor!
          const newX = startNodeX + (moveEvt.clientX - startClientX) / zoom;
          const newY = startNodeY + (moveEvt.clientY - startClientY) / zoom;

          node.style.left = `${newX}px`;
          node.style.top = `${newY}px`;
          devicePositions[d.id] = { x: newX, y: newY };
        }

        async function onMouseUp() {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          savePositions();
          renderConnections();

          // Save dragged position to server
          await fetch(`/api/devices/${d.id}/position`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: pos.x, y: pos.y })
          });

          // Re-render to update dynamic zone boundary boxes immediately
          renderNodes();
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      canvasContent.appendChild(node);
    });
  }

  function renderConnections() {
    svgOverlay.innerHTML = '';

    const filteredDevices = activeZoneFilter === 'ALL'
      ? devicesData
      : devicesData.filter(d => d.zone === activeZoneFilter);
      
    const visibleIds = new Set(filteredDevices.map(d => d.id));
    const filteredConnections = connectionsData.filter(c => visibleIds.has(c.from) && visibleIds.has(c.to));

    filteredConnections.forEach(conn => {
      const posA = devicePositions[conn.from];
      const posB = devicePositions[conn.to];
      if (!posA || !posB) return;

      const devA = devicesData.find(d => d.id === conn.from);
      const devB = devicesData.find(d => d.id === conn.to);
      if (!devA || !devB) return;

      const x1 = posA.x + 120;
      const y1 = posA.y + 35;
      const x2 = posB.x + 120;
      const y2 = posB.y + 35;

      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dx = x2 - x1;
      const dy = y2 - y1;
      const cx = x1 + dx / 2;
      const cy = y1 + dy / 2 - (dy > 0 ? 30 : -30);
      
      const dAttr = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
      pathEl.setAttribute('d', dAttr);

      // Classes
      let cableClass = 'cable-path';
      const isOnlineA = devA.isPowerConnected;
      const isOnlineB = devB.isPowerConnected;

      if (!isOnlineA || !isOnlineB) {
        cableClass += ' disconnected';
      } else if (devA.activeAttacks.length > 0 || devB.activeAttacks.length > 0) {
        cableClass += ' under-attack';
      }
      pathEl.setAttribute('class', cableClass);
      
      // Wire double click disconnect
      pathEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        removeWire(conn.from, conn.to);
      });

      svgOverlay.appendChild(pathEl);

      // Packet march indicator
      if (isOnlineA && isOnlineB && devA.isNetworkConnected && devB.isNetworkConnected && devA.approvalStatus === 'APPROVED' && devB.approvalStatus === 'APPROVED') {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', (devA.activeAttacks.length > 0 || devB.activeAttacks.length > 0) ? '#ff0055' : '#00f3ff');
        
        const isSpike = devA.activeAttacks.includes('TRAFFIC_SPIKE') || devB.activeAttacks.includes('TRAFFIC_SPIKE');
        circle.style.animation = `march ${isSpike ? '0.4s' : '2.5s'} linear infinite`;
        circle.style.offsetPath = `path('${dAttr}')`;
        svgOverlay.appendChild(circle);
      }
    });
  }

  function renderDetailsPane() {
    if (!selectedNodeId) {
      controlOverlay.style.display = 'none';
      return;
    }

    const device = devicesData.find(d => d.id === selectedNodeId);
    if (!device) {
      controlOverlay.style.display = 'none';
      selectedNodeId = null;
      return;
    }

    controlOverlay.style.display = 'flex';
    overlayDeviceTitle.innerText = `${device.type} - ${device.id}`;
    
    // Status Badge & Approve Button state
    if (device.approvalStatus === 'PENDING') {
      overlayApprovalBadge.innerText = 'CHỜ DUYỆT';
      overlayApprovalBadge.style.background = 'rgba(255, 159, 0, 0.2)';
      overlayApprovalBadge.style.color = 'var(--neon-orange)';
    } else {
      overlayApprovalBadge.innerText = 'ĐÃ DUYỆT';
      overlayApprovalBadge.style.background = 'rgba(57, 255, 20, 0.15)';
      overlayApprovalBadge.style.color = 'var(--neon-green)';
    }

    // Set configuration inputs
    overlayDevId.value = device.id;
    overlayDevName.value = device.name;
    overlayDevIp.value = device.ipAddress;
    overlayDevMac.value = device.macAddress;
    overlayDevZone.value = device.zone;
    overlayDevInterval.value = device.intervalMs;

    powerSwitch.checked = device.isPowerConnected;
    
    // Live network status text
    if (!device.isPowerConnected) {
      networkStatusView.innerText = 'OFFLINE';
      networkStatusView.style.color = '#555';
    } else if (device.isNetworkConnected) {
      networkStatusView.innerText = 'ONLINE';
      networkStatusView.style.color = 'var(--neon-green)';
    } else {
      networkStatusView.innerText = 'MẤT KẾT NỐI MẠNG';
      networkStatusView.style.color = 'var(--neon-orange)';
    }

    // Metrics view
    let metricsStr = '';
    const m = device.metrics || {};
    Object.keys(m).forEach(k => {
      metricsStr += `${k.toUpperCase()}: ${m[k]}\n`;
    });
    metricsView.innerText = metricsStr || 'Chua co thong so.';

    // Connection Links (rút cáp)
    connectedWiresView.innerHTML = '';
    const myWires = connectionsData.filter(c => c.from === device.id || c.to === device.id);
    if (myWires.length === 0) {
      connectedWiresView.innerHTML = '<div style="font-size:0.75rem;color:#555;">Chua cam cap mang.</div>';
    } else {
      myWires.forEach(w => {
        const neighbor = w.from === device.id ? w.to : w.from;
        const line = document.createElement('div');
        line.style.display = 'flex';
        line.style.justify = 'space-between';
        line.style.alignItems = 'center';
        line.style.fontSize = '0.78rem';
        line.innerHTML = `
          <span>Nối tới: ${neighbor}</span>
          <button style="background:none;border:none;color:var(--neon-red);cursor:pointer;font-weight:bold;">[Rút cáp]</button>
        `;
        line.querySelector('button').addEventListener('click', () => removeWire(w.from, w.to));
        connectedWiresView.appendChild(line);
      });
    }

    // Mitigations
    const physicalIncidents = ['FIRE', 'FLOOD', 'OVERHEAT'];
    const activePhysical = device.activeAttacks.filter(a => physicalIncidents.includes(a));
    
    if (activePhysical.length > 0 && device.isPowerConnected) {
      incidentsSection.style.display = 'block';
      mitigateActionsContainer.innerHTML = '';
      
      activePhysical.forEach(inc => {
        let label = 'Sửa chữa';
        if (inc === 'FIRE') label = '🧯 Phun bình chữa cháy';
        else if (inc === 'FLOOD') label = '💧 Bật máy bơm rút nước';
        else if (inc === 'OVERHEAT') label = '❄️ Bật quạt tản nhiệt';
        
        const btn = document.createElement('button');
        btn.className = 'mitigate-btn';
        btn.innerText = label;
        btn.addEventListener('click', async () => {
          await fetch(`/api/devices/${device.id}/mitigate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incidentType: inc })
          });
          fetchAndRender();
        });
        mitigateActionsContainer.appendChild(btn);
      });
    } else {
      incidentsSection.style.display = 'none';
    }
  }

  function updateTerminal() {
    let logsToShow = [];

    if (selectedNodeId) {
      const device = devicesData.find(d => d.id === selectedNodeId);
      if (device) {
        logsToShow = device.logs || [];
        terminalTitle.innerText = `Lịch sử nhật ký (Syslog) - Thiết bị [${device.id}]`;
      }
    } else {
      terminalTitle.innerText = `SIEM central log stream (Tất cả thiết bị)`;
      
      const allLogs = [];
      devicesData.forEach(d => {
        if (d.logs) {
          d.logs.forEach(line => {
            allLogs.push(line);
          });
        }
      });

      allLogs.sort((a, b) => {
        const timeA = extractTimestamp(a);
        const timeB = extractTimestamp(b);
        return timeA.localeCompare(timeB);
      });

      logsToShow = allLogs.slice(-50);
    }

    terminal.innerHTML = '';
    if (logsToShow.length === 0) {
      terminal.innerHTML = '<div class="log-line" style="color:#555;">[Hệ thống chưa ghi nhận log nào...]</div>';
      return;
    }

    logsToShow.forEach(log => {
      let level = 'INFO';
      if (log.includes('severity="CRITICAL"')) level = 'CRITICAL';
      else if (log.includes('severity="WARN"')) level = 'WARN';
      else if (log.includes('severity="ERROR"')) level = 'ERROR';

      const ts = extractTimestamp(log);
      const cleanLogMsg = log.split('ics-guard - - [meta')[1]?.split(']')[1]?.trim() || log;

      const lineDiv = document.createElement('div');
      lineDiv.className = 'log-line';
      
      const tsSpan = document.createElement('span');
      tsSpan.className = 'timestamp';
      tsSpan.innerText = `[${ts}] `;

      const lvlSpan = document.createElement('span');
      lvlSpan.className = `level-${level.toLowerCase()}`;
      lvlSpan.innerText = `[${level}] `;

      const msgSpan = document.createElement('span');
      msgSpan.innerText = cleanLogMsg;

      lineDiv.appendChild(tsSpan);
      lineDiv.appendChild(lvlSpan);
      lineDiv.appendChild(msgSpan);
      terminal.appendChild(lineDiv);
    });

    terminal.scrollTop = terminal.scrollHeight;
  }

  function extractTimestamp(logLine) {
    const match = logLine.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/);
    return match ? match[0] : '';
  }

  canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target === svgOverlay) {
      selectedNodeId = null;
      controlOverlay.style.display = 'none';
      document.querySelectorAll('.node-element').forEach(n => n.classList.remove('selected'));
      updateTerminal();
    }
  });

  // Start polling loops
  fetchAndRender();
  setInterval(fetchAndRender, 1000);
});
