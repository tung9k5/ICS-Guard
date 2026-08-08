import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import http from '@/api/httpClient';
import socket from '@/services/socket';
import { toast } from '@/utils/toast';
import { Network, Server, Cpu, Lock, ShieldAlert, ShieldCheck, Zap, Droplets, Wind } from 'lucide-react';
import './Topology.scss';

const CustomNode = ({ data }) => {
  return (
    <div className={`topology-custom-node status-${data.status}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-icon">
        {data.icon || <Server size={20} />}
      </div>
      <div className="node-content">
        <div className="node-title">{data.label}</div>
        <div className="node-ip">{data.ip}</div>
        <div className="node-zone">{data.zone}</div>
      </div>
      {data.status === 'quarantined' && <div className="status-badge error"><ShieldAlert size={12}/></div>}
      {data.status === 'active' && <div className="status-badge success"><ShieldCheck size={12}/></div>}
      {data.status === 'isolated' && <div className="status-badge warning"><Lock size={12}/></div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

const Topology = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const fetchTopology = async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await http.get('/devices');
      } catch (e) {
        res = await http.get('/devices/public/list-all');
      }
      const deviceList = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);

      const newNodes = [];
      const newEdges = [];

      // Group devices into 3 Zones: Zone A, Zone B, Zone C
      const zones = {
        'Zone-A': [],
        'Zone-B': [],
        'Zone-C': [],
        'Other': []
      };

      deviceList.forEach(d => {
        const z = d.zone || 'Other';
        if (zones[z]) zones[z].push(d);
        else zones['Zone-A'].push(d);
      });

      const CM_2_PX = 76; // 2cm in CSS pixels (1cm ≈ 37.8px)
      const NODE_W = 180;
      const NODE_H = 76;
      const H_STEP = NODE_W + CM_2_PX; // 256px -> 76px edge-to-edge gap between adjacent nodes
      const V_STEP = NODE_H + CM_2_PX; // 152px -> 76px edge-to-edge gap between rows

      let currentZoneX = CM_2_PX;

      Object.entries(zones).forEach(([zoneKey, items]) => {
        if (items.length === 0) return;

        const roots = items.filter(i => !i.parent_id || i.type === 'Gateway');
        const children = items.filter(i => i.parent_id && i.type !== 'Gateway');

        const rootCols = Math.max(1, roots.length);
        const childCols = Math.min(4, Math.max(1, children.length));
        const numCols = Math.max(rootCols, childCols);
        const childRows = Math.ceil(children.length / 4);

        const zoneInnerWidth = numCols * NODE_W + (numCols - 1) * CM_2_PX;
        const zoneWidth = CM_2_PX + zoneInnerWidth + CM_2_PX;
        const zoneHeaderHeight = 40;

        const rootY = CM_2_PX + zoneHeaderHeight; // Top margin 76px (2cm) under header
        const childrenStartY = roots.length > 0 ? rootY + NODE_H + CM_2_PX : rootY;
        const zoneHeight = rootY + (roots.length > 0 ? NODE_H + CM_2_PX : 0) + (childRows > 0 ? childRows * NODE_H + (childRows - 1) * CM_2_PX : 0) + CM_2_PX;

        const groupId = `group-${zoneKey}`;
        newNodes.push({
          id: groupId,
          type: 'group',
          data: { label: zoneKey },
          position: { x: currentZoneX, y: CM_2_PX },
          style: {
            width: zoneWidth,
            height: zoneHeight,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            border: '2px dashed rgba(59, 130, 246, 0.4)',
            borderRadius: '12px',
          }
        });

        roots.forEach((r, idx) => {
          newNodes.push({
            id: r._id || r.id,
            type: 'custom',
            parentNode: groupId,
            extent: 'parent',
            position: { x: CM_2_PX + idx * H_STEP, y: rootY },
            data: { label: r.name, ip: r.ipAddress || r.ip_address, zone: r.zone, status: r.status, icon: <Network size={20} /> }
          });
        });

        children.forEach((c, idx) => {
          const row = Math.floor(idx / 4);
          const col = idx % 4;
          const id = c._id || c.id;
          newNodes.push({
            id,
            type: 'custom',
            parentNode: groupId,
            extent: 'parent',
            position: { x: CM_2_PX + col * H_STEP, y: childrenStartY + row * V_STEP },
            data: { 
              label: c.name, 
              ip: c.ipAddress || c.ip_address, 
              zone: c.zone,
              status: c.status, 
              icon: c.type === 'Controller' ? <Cpu size={20} /> : c.zone === 'Zone-B' ? <Zap size={20} /> : <Droplets size={20} /> 
            }
          });

          if (c.parent_id) {
            newEdges.push({
              id: `e-${c.parent_id}-${id}`,
              source: c.parent_id,
              target: id,
              type: 'smoothstep',
              animated: c.status === 'active',
              style: { stroke: c.status === 'quarantined' ? '#ef4444' : '#3b82f6', strokeWidth: 2 }
            });
          }
        });

        currentZoneX += zoneWidth + CM_2_PX; // 2cm (76px) gap between zone boxes
      });

      setNodes(newNodes);
      setEdges(newEdges);
    } catch (err) {
      toast.error('Lỗi tải sơ đồ Topology');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopology();

    socket.on('DEVICE_STATUS_CHANGED', (data) => {
      setNodes(nds => nds.map(n => {
        if (n.id === data._id) {
          n.data = { ...n.data, status: data.status };
        }
        return n;
      }));
    });
    return () => socket.off('DEVICE_STATUS_CHANGED');
  }, []);

  return (
    <div className="topology-page">
      <div className="topology-header">
        <div className="title-section">
          <h1>Sơ đồ Mạng Phân Vùng 50 Thiết Bị (Purdue Zone A, B, C Topology)</h1>
          <p>Mô phỏng mạng công nghiệp thời gian thực kết nối 50 thiết bị thuộc 3 phân vùng chính.</p>
        </div>
      </div>
      <div style={{ height: 'calc(100vh - 150px)', width: '100%', background: '#0f172a', borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? <div style={{color: 'white', padding: 20}}>Đang nạp sơ đồ 50 thiết bị mạng...</div> : (
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            theme="dark"
          >
            <Background color="#334155" gap={16} />
            <Controls />
            <MiniMap style={{ background: '#1e293b' }} nodeColor="#475569" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};

export default Topology;
