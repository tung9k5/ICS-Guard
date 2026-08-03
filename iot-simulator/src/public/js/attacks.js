document.addEventListener('DOMContentLoaded', () => {
  const explorerRoot = document.getElementById('explorer-root');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const selectedCountLabel = document.getElementById('selected-count-label');
  const launchBtn = document.getElementById('launch-attack-btn');
  const stopBtn = document.getElementById('stop-attacks-btn');
  
  const attackOptionBtns = document.querySelectorAll('.attack-option-btn');

  let selectedDeviceIds = [];
  let selectedAttackType = null;
  let devicesData = [];

  // Global folder state persistence
  const folderStates = {};
  let isFirstExplorerLoad = true;

  // Category mapping function (Purdue model / toolbox levels)
  function getDeviceCategory(type) {
    if (type === 'GATEWAY') return '1. Thiết Bị Mạng (Network & Sec)';
    if (type === 'PLC' || type === 'HMI') return '2. Bộ Điều Khiển (Controllers)';
    if (type === 'CHIP') return '3. Chip Vi Điều Khiển (Microchips)';
    if (type === 'SENSOR') return '4. Cảm Biến (Sensors)';
    if (type === 'ACTUATOR' || type === 'FIRE_ALARM') return '5. Cơ Cấu Chấp Hành (Actuators)';
    return '6. Khác (Others)';
  }

  // 1. Attack template selection
  attackOptionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      attackOptionBtns.forEach(b => b.classList.remove('selected'));
      
      const attack = btn.dataset.attack;
      if (selectedAttackType === attack) {
        selectedAttackType = null;
      } else {
        selectedAttackType = attack;
        btn.classList.add('selected');
      }
      
      updateButtonState();
    });
  });

  // 2. Select / Deselect actions
  selectAllBtn.addEventListener('click', () => {
    selectedDeviceIds = devicesData.map(d => d.id);
    document.querySelectorAll('.device-checkbox').forEach(cb => cb.checked = true);
    updateSelectionUI();
  });

  deselectAllBtn.addEventListener('click', () => {
    selectedDeviceIds = [];
    document.querySelectorAll('.device-checkbox').forEach(cb => cb.checked = false);
    updateSelectionUI();
  });

  // 3. Launch & Stop actions
  launchBtn.addEventListener('click', async () => {
    if (selectedDeviceIds.length === 0 || !selectedAttackType) return;
    
    launchBtn.disabled = true;
    launchBtn.innerText = 'ĐANG KÍCH HOẠT...';
    
    try {
      await fetch('/api/attacks/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: selectedDeviceIds,
          attackType: selectedAttackType
        })
      });
      
      launchBtn.innerText = 'KÍCH HOẠT THÀNH CÔNG!';
      setTimeout(() => {
        launchBtn.innerText = 'KÍCH HOẠT SỰ CỐ';
        launchBtn.disabled = false;
        updateButtonState();
      }, 1500);

      selectedAttackType = null;
      attackOptionBtns.forEach(b => b.classList.remove('selected'));

      fetchAndRender();
    } catch (err) {
      console.error(err);
      launchBtn.innerText = 'KÍCH HOẠT LỖI';
      setTimeout(() => {
        launchBtn.innerText = 'KÍCH HOẠT SỰ CỐ';
        launchBtn.disabled = false;
        updateButtonState();
      }, 1500);
    }
  });

  stopBtn.addEventListener('click', async () => {
    const targets = selectedDeviceIds.length > 0 
      ? selectedDeviceIds 
      : devicesData.map(d => d.id);
      
    stopBtn.disabled = true;
    stopBtn.innerText = 'ĐANG DỪNG...';

    try {
      await fetch('/api/attacks/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceIds: targets })
      });

      stopBtn.innerText = 'ĐÃ DỪNG THÀNH CÔNG!';
      setTimeout(() => {
        stopBtn.innerText = 'Dừng Toàn Bộ Sự Cố';
        stopBtn.disabled = false;
      }, 1500);

      fetchAndRender();
    } catch (err) {
      console.error(err);
      stopBtn.innerText = 'THẤT BẠI';
      setTimeout(() => {
        stopBtn.innerText = 'Dừng Toàn Bộ Sự Cố';
        stopBtn.disabled = false;
      }, 1500);
    }
  });

  // 4. Main Polling Loop
  async function fetchAndRender() {
    try {
      const res = await fetch('/api/devices');
      devicesData = await res.json();
      
      renderExplorerTree();
      updateSelectionUI();
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }

  function renderExplorerTree() {
    // 1. Group devices by Zone, then by Category Level
    const zones = {};
    devicesData.forEach(d => {
      const zoneName = d.zone || 'Unknown';
      if (!zones[zoneName]) {
        zones[zoneName] = {};
      }
      const cat = getDeviceCategory(d.type);
      if (!zones[zoneName][cat]) {
        zones[zoneName][cat] = [];
      }
      zones[zoneName][cat].push(d);
    });

    // 2. Initialize default open states on first load
    if (isFirstExplorerLoad) {
      isFirstExplorerLoad = false;
      Object.keys(zones).forEach(zoneName => {
        folderStates[zoneName] = true; // Open Zone by default
        Object.keys(zones[zoneName]).forEach(cat => {
          folderStates[zoneName + '|' + cat] = true; // Open Subfolder by default
        });
      });
    }

    explorerRoot.innerHTML = '';

    // Sort zone names
    const sortedZones = Object.keys(zones).sort();

    sortedZones.forEach(zoneName => {
      const folderLi = document.createElement('li');
      folderLi.className = 'tree-folder';
      folderLi.dataset.zone = zoneName;

      // Count devices inside zone
      let totalZoneDevs = 0;
      Object.keys(zones[zoneName]).forEach(cat => {
        totalZoneDevs += zones[zoneName][cat].length;
      });
      
      const isFolderOpen = folderStates[zoneName] !== false; // Default true
      if (isFolderOpen) folderLi.classList.add('open');

      const titleDiv = document.createElement('div');
      titleDiv.className = 'tree-folder-title';
      titleDiv.innerText = `${zoneName} (${totalZoneDevs})`;
      titleDiv.addEventListener('click', () => {
        folderLi.classList.toggle('open');
        folderStates[zoneName] = folderLi.classList.contains('open');
      });

      const childrenUl = document.createElement('ul');
      childrenUl.className = 'tree-folder-children';

      // Sort categories
      const sortedCats = Object.keys(zones[zoneName]).sort();

      sortedCats.forEach(cat => {
        const subfolderLi = document.createElement('li');
        subfolderLi.className = 'tree-subfolder';
        
        const subfolderStateKey = zoneName + '|' + cat;
        const isSubfolderOpen = folderStates[subfolderStateKey] !== false; // Default true
        if (isSubfolderOpen) subfolderLi.classList.add('open');

        const subfolderTitle = document.createElement('div');
        subfolderTitle.className = 'tree-subfolder-title';
        subfolderTitle.innerText = `${cat} (${zones[zoneName][cat].length})`;
        subfolderTitle.addEventListener('click', () => {
          subfolderLi.classList.toggle('open');
          folderStates[subfolderStateKey] = subfolderLi.classList.contains('open');
        });

        const subfolderChildrenUl = document.createElement('ul');
        subfolderChildrenUl.className = 'tree-subfolder-children';

        // Render devices inside subfolder
        zones[zoneName][cat].forEach(device => {
          const itemLi = document.createElement('li');
          itemLi.className = 'tree-item';
          
          const isUnderAttack = device.activeAttacks.length > 0;
          if (isUnderAttack) {
            itemLi.classList.add('under-attack');
          }

          const isChecked = selectedDeviceIds.includes(device.id);

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'device-checkbox';
          checkbox.dataset.id = device.id;
          checkbox.checked = isChecked;
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              if (!selectedDeviceIds.includes(device.id)) selectedDeviceIds.push(device.id);
            } else {
              selectedDeviceIds = selectedDeviceIds.filter(id => id !== device.id);
            }
            updateSelectionUI();
          });

          itemLi.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
              checkbox.checked = !checkbox.checked;
              checkbox.dispatchEvent(new Event('change'));
            }
          });

          let statusColor = 'var(--neon-green)'; // Active
          if (!device.isPowerConnected) statusColor = '#555'; // Offline
          else if (!device.isNetworkConnected) statusColor = 'var(--neon-orange)'; // Isolated
          else if (isUnderAttack) statusColor = 'var(--neon-red)'; // Attack

          const statusDot = document.createElement('span');
          statusDot.className = 'device-indicator';
          statusDot.style.backgroundColor = statusColor;

          if (isUnderAttack) {
            statusDot.style.boxShadow = '0 0 8px var(--neon-red)';
            statusDot.style.animation = 'pulse-red-border 1s infinite';
          }

          const infoSpan = document.createElement('span');
          infoSpan.innerText = `${device.id} - ${device.name}`;

          itemLi.appendChild(checkbox);
          itemLi.appendChild(statusDot);
          itemLi.appendChild(infoSpan);

          if (isUnderAttack) {
            const badge = document.createElement('span');
            badge.style.fontSize = '0.62rem';
            badge.style.background = 'var(--neon-red)';
            badge.style.color = 'white';
            badge.style.padding = '0.1rem 0.25rem';
            badge.style.borderRadius = '3px';
            badge.style.marginLeft = '0.4rem';
            badge.innerText = device.activeAttacks.join(', ');
            itemLi.appendChild(badge);
          }

          subfolderChildrenUl.appendChild(itemLi);
        });

        subfolderLi.appendChild(subfolderTitle);
        subfolderLi.appendChild(subfolderChildrenUl);
        childrenUl.appendChild(subfolderLi);
      });

      folderLi.appendChild(titleDiv);
      folderLi.appendChild(childrenUl);
      explorerRoot.appendChild(folderLi);
    });
  }

  function updateSelectionUI() {
    selectedCountLabel.innerText = `${selectedDeviceIds.length} thiết bị`;
    updateButtonState();
  }

  function updateButtonState() {
    if (selectedDeviceIds.length > 0 && selectedAttackType !== null) {
      launchBtn.removeAttribute('disabled');
    } else {
      launchBtn.setAttribute('disabled', 'true');
    }
  }

  // Start polling
  fetchAndRender();
  setInterval(fetchAndRender, 1000);
});
