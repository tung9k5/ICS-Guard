import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportIncidentsToPDF = (incidents) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text('Bao Cao Su Co Bao Mat (Incident Report)', 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Ngay xuat: ${new Date().toLocaleString()}`, 14, 30);
  
  const tableColumn = ["ID", "Ten Su Co", "Muc Do", "Trang Thai", "Ngay Tao"];
  const tableRows = [];

  incidents.forEach(incident => {
    const rowData = [
      incident._id || incident.id,
      incident.title,
      incident.severity,
      incident.status,
      new Date(incident.createdAt).toLocaleDateString()
    ];
    tableRows.push(rowData);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save(`ICS_Incident_Report_${new Date().getTime()}.pdf`);
};
