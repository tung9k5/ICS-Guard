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

      const zoneXOffsets = {
        'Zone-A': 50,
        'Zone-B': 950,
        'Zone-C': 1850,
        'Other': 2750
      };

      Object.entries(zones).forEach(([zoneKey, items]) => {
        if (items.length === 0) return;
        const baseX = zoneXOffsets[zoneKey] || 50;

        // Separate Gateways (roots) and leaf devices
        const roots = items.filter(i => !i.parent_id || i.type === 'Gateway');
        const children = items.filter(i => i.parent_id && i.type !== 'Gateway');

        // Place roots at top
        roots.forEach((r, idx) => {
          newNodes.push({
            id: r._id || r.id,
            type: 'custom',
            position: { x: baseX + (idx * 240), y: 50 },
            data: { label: r.name, ip: r.ipAddress || r.ip_address, zone: r.zone, status: r.status, icon: <Network size={20} /> }
          });
        });

        // Place children in a clean grid below
        children.forEach((c, idx) => {
          const row = Math.floor(idx / 4);
          const col = idx % 4;
          const id = c._id || c.id;
          newNodes.push({
            id,
            type: 'custom',
            position: { x: baseX + (col * 210), y: 200 + (row * 140) },
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
