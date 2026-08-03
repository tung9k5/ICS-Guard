import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResponseWorkspace from './index';

vi.mock('@/api/incidents', () => ({ default: { getForensics: vi.fn(), getAttackGraph: vi.fn() } }));

const baseCase = status => ({
  incident: { _id: 'incident-1', title: 'Unauthorized Modbus write', severity: 'CRITICAL', status: 'open', createdAt: new Date().toISOString(), alert_ids: ['alert-1'] },
  device: { _id: 'device-1', name: 'PLC-01', ipAddress: '10.0.0.5', security_status: status, status: status === 'isolated' ? 'isolated' : 'active' },
  deviceId: 'device-1',
  timeline: [],
});

const renderWorkspace = responseCase => render(<ResponseWorkspace visible responseCase={responseCase} onIsolate={vi.fn()} onAiRemediation={vi.fn()} onRestore={vi.fn()} onCloseIncident={vi.fn()}/>);

describe('Incident Response Workspace', () => {
  it('starts as a compact dock and requires explicit incident acknowledgement', () => {
    renderWorkspace(baseCase('normal'));
    fireEvent.click(screen.getByRole('button', { name: /Mở trung tâm ứng phó/i }));
    expect(screen.getByRole('button', { name: /Tiếp nhận sự cố/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cô lập khẩn cấp/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tiếp nhận sự cố/i }));
    expect(screen.getByRole('button', { name: /Cô lập khẩn cấp/i })).toBeInTheDocument();
  });

  it('allows manual investigation but gates recovery behind the operator checklist', () => {
    renderWorkspace(baseCase('isolated'));
    fireEvent.click(screen.getByRole('button', { name: /Mở trung tâm ứng phó/i }));
    fireEvent.click(screen.getByRole('button', { name: /Đã điều tra thủ công/i }));
    const restore = screen.getByRole('button', { name: /Khôi phục thiết bị/i });
    expect(restore).toBeDisabled();
    screen.getAllByRole('checkbox').forEach(checkbox => fireEvent.click(checkbox));
    expect(restore).toBeEnabled();
  });

  it('routes an available AI result to a scannable report instead of requesting it again', () => {
    const onAiRemediation = vi.fn();
    const responseCase = {
      ...baseCase('isolated'),
      aiAdvice: 'CHẨN ĐOÁN AI DỰA TRÊN BẰNG CHỨNG\n\n1. Tóm tắt\nĐúng trọng tâm PLC-01.\n\n2. Bằng chứng\n- [EV-1] FC06.',
    };
    render(<ResponseWorkspace visible responseCase={responseCase} onIsolate={vi.fn()} onAiRemediation={onAiRemediation} onRestore={vi.fn()} onCloseIncident={vi.fn()}/>);

    fireEvent.click(screen.getByRole('button', { name: /Mở trung tâm ứng phó/i }));
    fireEvent.click(screen.getByRole('button', { name: /Xem chẩn đoán AI/i }));

    expect(screen.getByRole('heading', { name: /Tóm tắt/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^2\. Bằng chứng$/i })).toBeInTheDocument();
    expect(screen.getByText(/Đúng trọng tâm PLC-01/i)).toBeInTheDocument();
    expect(onAiRemediation).not.toHaveBeenCalled();
  });

  it('requires an actual closure note and submits the operator verification payload', () => {
    const onCloseIncident = vi.fn();
    const responseCase = { ...baseCase('normal'), recoveryCompleted: true };
    render(<ResponseWorkspace visible responseCase={responseCase} onIsolate={vi.fn()} onAiRemediation={vi.fn()} onRestore={vi.fn()} onCloseIncident={onCloseIncident}/>);

    fireEvent.click(screen.getByRole('button', { name: /Mở trung tâm ứng phó/i }));
    const closeButton = screen.getByRole('button', { name: /Xác minh & Đóng sự cố/i });
    screen.getAllByRole('checkbox').forEach(checkbox => fireEvent.click(checkbox));
    fireEvent.change(screen.getByRole('textbox', { name: /Ghi nhận kết quả xử lý/i }), { target: { value: 'Ngắn' } });
    expect(closeButton).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: /Ghi nhận kết quả xử lý/i }), { target: { value: 'PLC-01 ổn định sau 15 phút giám sát.' } });
    expect(closeButton).toBeEnabled();
    fireEvent.click(closeButton);

    expect(onCloseIncident).toHaveBeenCalledWith({
      device_id: 'device-1',
      verification: {
        device_operational: true,
        traffic_normal: true,
        resolution_documented: true,
      },
      note: 'PLC-01 ổn định sau 15 phút giám sát.',
    });
  });

  it('resumes at containment after reload and does not duplicate a pending isolate command', () => {
    const responseCase = {
      ...baseCase('normal'),
      incident: { ...baseCase('normal').incident, status: 'investigating' },
      timeline: [{
        event_time: new Date().toISOString(),
        action_type: 'playbook_execution',
        metadata: { command_type: 'isolate', status: 'accepted' },
      }],
    };
    renderWorkspace(responseCase);

    fireEvent.click(screen.getByRole('button', { name: /Mở trung tâm ứng phó/i }));

    expect(screen.queryByRole('button', { name: /Tiếp nhận sự cố/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đang chờ xác nhận cô lập/i })).toBeDisabled();
  });
});
