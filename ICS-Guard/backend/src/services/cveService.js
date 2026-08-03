import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CveService {
  constructor() {
    this.apiKey = process.env.NVD_API_KEY;
    this.baseUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
    this.staticPath = path.join(__dirname, '../data/cve_static.json');
  }

  async fetchDeviceCves(keyword) {
    let cves = [];
    
    // Load static CVEs first
    try {
      if (fs.existsSync(this.staticPath)) {
        const rawData = fs.readFileSync(this.staticPath, 'utf8');
        const cleanData = rawData.replace(/^\uFEFF/, '').trim();
        const staticData = JSON.parse(cleanData);
        cves = staticData.filter(c => c.description.toLowerCase().includes(keyword.toLowerCase()));
      }
    } catch(e) {
      console.error('[CveService] Static CVE load error:', e);
    }

    // Try NVD API if key exists
    if (this.apiKey) {
      try {
        const response = await fetch(`${this.baseUrl}?keywordSearch=${encodeURIComponent(keyword)}&resultsPerPage=5`, {
          headers: { 'apiKey': this.apiKey }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.vulnerabilities) {
            const apiCves = data.vulnerabilities.map(v => {
              const cve = v.cve;
              return {
                cve_id: cve.id,
                description: cve.descriptions?.[0]?.value || 'No description',
                severity: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || 'UNKNOWN',
                cvss: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0
              };
            });
            // Merge avoiding duplicates
            const existingIds = new Set(cves.map(c => c.cve_id));
            for (const ac of apiCves) {
              if (!existingIds.has(ac.cve_id)) {
                cves.push(ac);
              }
            }
          }
        }
      } catch (err) {
        console.error('[CveService] NVD API Fetch Error:', err.message);
      }
    }
    return cves;
  }
}
export default new CveService();
