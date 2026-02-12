/**
 * Export Service for OR-SST
 * 
 * Extensible export system using a registry pattern.
 * To add a new export type:
 * 1. Create an exporter class extending BaseExporter
 * 2. Register it with ExportService.register('type', ExporterClass)
 */

// ============================================================================
// Base Exporter Class
// ============================================================================

class BaseExporter {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Export data to the target format
   * @param {ExportData} data - The data to export
   * @returns {Blob} - The exported file as a Blob
   */
  export(data) {
    throw new Error('export() must be implemented by subclass');
  }

  /**
   * Get the file extension for this export type
   * @returns {string}
   */
  getExtension() {
    throw new Error('getExtension() must be implemented by subclass');
  }

  /**
   * Get the MIME type for this export type
   * @returns {string}
   */
  getMimeType() {
    throw new Error('getMimeType() must be implemented by subclass');
  }

  /**
   * Get human-readable name for this export type
   * @returns {string}
   */
  getDisplayName() {
    throw new Error('getDisplayName() must be implemented by subclass');
  }

  /**
   * Download the exported file
   * @param {ExportData} data - The data to export
   * @param {string} filename - Base filename without extension
   */
  download(data, filename = 'export') {
    const blob = this.export(data);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${this.getExtension()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// Export Data Structure
// ============================================================================

/**
 * Standardized export data structure
 */
class ExportData {
  constructor({
    transcript = '',
    extractionResult = {},
    rawEntities = [],
    metadata = {}
  } = {}) {
    this.transcript = transcript;
    this.extractionResult = extractionResult;
    this.rawEntities = rawEntities;
    this.metadata = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      ...metadata
    };
  }

  /**
   * Flatten nested objects for tabular formats
   * @param {Object} obj - Object to flatten
   * @param {string} prefix - Key prefix
   * @returns {Object} - Flattened object
   */
  static flattenObject(obj, prefix = '') {
    const result = {};
    
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      
      const newKey = prefix ? `${prefix}_${key}` : key;
      const value = obj[key];
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, ExportData.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        result[newKey] = value.map(item =>
          typeof item === 'object' ? JSON.stringify(item) : item
        ).join('; ');
      } else {
        result[newKey] = value;
      }
    }
    
    return result;
  }

  /**
   * Get flattened extraction result
   * @returns {Object}
   */
  getFlattenedResult() {
    return ExportData.flattenObject(this.extractionResult);
  }

  /**
   * Get entities formatted for tabular display
   * @returns {Array<Object>}
   */
  getFormattedEntities() {
    return this.rawEntities.map(entity => ({
      word: entity.word || '',
      label: entity.entity || '',
      confidence: ((entity.score || 0) * 100).toFixed(1),
      start: entity.start || 0,
      end: entity.end || 0
    }));
  }
}

// ============================================================================
// JSON Exporter
// ============================================================================

class JSONExporter extends BaseExporter {
  export(data) {
    const exportObj = {
      metadata: data.metadata,
      transcript: data.transcript,
      extractionResult: data.extractionResult,
      rawEntities: data.rawEntities
    };
    
    const jsonString = JSON.stringify(exportObj, null, 2);
    return new Blob([jsonString], { type: this.getMimeType() });
  }

  getExtension() {
    return 'json';
  }

  getMimeType() {
    return 'application/json';
  }

  getDisplayName() {
    return 'JSON';
  }
}

// ============================================================================
// CSV Exporter
// ============================================================================

class CSVExporter extends BaseExporter {
  constructor(options = {}) {
    super(options);
    this.delimiter = options.delimiter || ',';
    this.includeHeaders = options.includeHeaders !== false;
  }

  export(data) {
    const entities = data.getFormattedEntities();
    
    if (entities.length === 0) {
      throw new Error('No entities to export');
    }

    const headers = ['Entity', 'Label', 'Confidence (%)', 'Start', 'End'];
    const rows = entities.map(e => [
      this.escapeCSV(e.word),
      e.label,
      e.confidence,
      e.start,
      e.end
    ]);

    let csvContent = '';
    if (this.includeHeaders) {
      csvContent += headers.join(this.delimiter) + '\n';
    }
    csvContent += rows.map(r => r.join(this.delimiter)).join('\n');

    return new Blob([csvContent], { type: this.getMimeType() });
  }

  escapeCSV(value) {
    const str = String(value);
    if (str.includes(this.delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  getExtension() {
    return 'csv';
  }

  getMimeType() {
    return 'text/csv;charset=utf-8;';
  }

  getDisplayName() {
    return 'CSV';
  }
}

// ============================================================================
// Excel Exporter (SpreadsheetML XML)
// ============================================================================

class ExcelExporter extends BaseExporter {
  export(data) {
    const flatData = data.getFlattenedResult();
    const entities = data.getFormattedEntities();

    let xml = this.getXMLHeader();
    xml += this.getStyles();
    
    // Sheet 1: Extracted Information
    xml += this.createExtractedInfoSheet(flatData);
    
    // Sheet 2: Raw Entities
    if (entities.length > 0) {
      xml += this.createEntitiesSheet(entities);
    }
    
    // Sheet 3: Transcript
    xml += this.createTranscriptSheet(data.transcript);
    
    // Sheet 4: Metadata
    xml += this.createMetadataSheet(data.metadata);
    
    xml += '</Workbook>';

    return new Blob([xml], { type: this.getMimeType() });
  }

  getXMLHeader() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`;
  }

  getStyles() {
    return `
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1976D2" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="SubHeader">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E3F2FD" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Number">
      <NumberFormat ss:Format="0.0"/>
      <Alignment ss:Horizontal="Right"/>
    </Style>
    <Style ss:ID="Text">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
  </Styles>`;
  }

  createExtractedInfoSheet(flatData) {
    let sheet = `
  <Worksheet ss:Name="Extracted Info">
    <Table>
      <Column ss:Width="200"/>
      <Column ss:Width="300"/>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Field</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell>
      </Row>`;

    for (const [key, value] of Object.entries(flatData)) {
      const displayKey = this.formatFieldName(key);
      const displayValue = this.escapeXML(value);
      sheet += `
      <Row>
        <Cell ss:StyleID="SubHeader"><Data ss:Type="String">${displayKey}</Data></Cell>
        <Cell ss:StyleID="Text"><Data ss:Type="String">${displayValue}</Data></Cell>
      </Row>`;
    }

    sheet += `
    </Table>
  </Worksheet>`;
    return sheet;
  }

  createEntitiesSheet(entities) {
    let sheet = `
  <Worksheet ss:Name="Raw Entities">
    <Table>
      <Column ss:Width="150"/>
      <Column ss:Width="120"/>
      <Column ss:Width="80"/>
      <Column ss:Width="60"/>
      <Column ss:Width="60"/>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Entity</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Label</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Confidence (%)</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Start</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">End</Data></Cell>
      </Row>`;

    for (const entity of entities) {
      sheet += `
      <Row>
        <Cell><Data ss:Type="String">${this.escapeXML(entity.word)}</Data></Cell>
        <Cell><Data ss:Type="String">${entity.label}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${entity.confidence}</Data></Cell>
        <Cell><Data ss:Type="Number">${entity.start}</Data></Cell>
        <Cell><Data ss:Type="Number">${entity.end}</Data></Cell>
      </Row>`;
    }

    sheet += `
    </Table>
  </Worksheet>`;
    return sheet;
  }

  createTranscriptSheet(transcript) {
    return `
  <Worksheet ss:Name="Transcript">
    <Table>
      <Column ss:Width="600"/>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Original Transcript</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Text"><Data ss:Type="String">${this.escapeXML(transcript || '')}</Data></Cell>
      </Row>
    </Table>
  </Worksheet>`;
  }

  createMetadataSheet(metadata) {
    let sheet = `
  <Worksheet ss:Name="Metadata">
    <Table>
      <Column ss:Width="150"/>
      <Column ss:Width="250"/>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Property</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell>
      </Row>`;

    for (const [key, value] of Object.entries(metadata)) {
      sheet += `
      <Row>
        <Cell ss:StyleID="SubHeader"><Data ss:Type="String">${this.formatFieldName(key)}</Data></Cell>
        <Cell><Data ss:Type="String">${this.escapeXML(value)}</Data></Cell>
      </Row>`;
    }

    sheet += `
    </Table>
  </Worksheet>`;
    return sheet;
  }

  formatFieldName(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  escapeXML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  getExtension() {
    return 'xls';
  }

  getMimeType() {
    return 'application/vnd.ms-excel';
  }

  getDisplayName() {
    return 'Excel';
  }
}

// ============================================================================
// Text Report Exporter
// ============================================================================

class TextReportExporter extends BaseExporter {
  export(data) {
    const flatData = data.getFlattenedResult();
    const entities = data.getFormattedEntities();
    
    let report = '';
    report += this.createHeader('OR-SST EXTRACTION REPORT');
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Version: ${data.metadata.version || '1.0'}\n\n`;
    
    // Transcript Section
    report += this.createSection('TRANSCRIPT', data.transcript || 'No transcript available');
    
    // Extracted Information Section
    if (Object.keys(flatData).length > 0) {
      let infoContent = '';
      for (const [key, value] of Object.entries(flatData)) {
        if (value !== null && value !== undefined && value !== '' && value !== 'false') {
          const displayKey = key.replace(/_/g, ' ').toUpperCase();
          infoContent += `${displayKey}: ${value}\n`;
        }
      }
      report += this.createSection('EXTRACTED INFORMATION', infoContent);
    }
    
    // Entities Section
    if (entities.length > 0) {
      let entitiesContent = 'Entity | Label | Confidence\n';
      entitiesContent += '-'.repeat(50) + '\n';
      for (const entity of entities) {
        entitiesContent += `${entity.word} | ${entity.label} | ${entity.confidence}%\n`;
      }
      report += this.createSection('RAW ENTITIES', entitiesContent);
    }

    return new Blob([report], { type: this.getMimeType() });
  }

  createHeader(title) {
    return `${'='.repeat(60)}\n${title}\n${'='.repeat(60)}\n\n`;
  }

  createSection(title, content) {
    return `${title}\n${'-'.repeat(40)}\n${content}\n\n`;
  }

  getExtension() {
    return 'txt';
  }

  getMimeType() {
    return 'text/plain;charset=utf-8';
  }

  getDisplayName() {
    return 'Text Report';
  }
}

// ============================================================================
// HTML Report Exporter
// ============================================================================

class HTMLReportExporter extends BaseExporter {
  export(data) {
    const flatData = data.getFlattenedResult();
    const entities = data.getFormattedEntities();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OR-SST Extraction Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1976d2; border-bottom: 3px solid #1976d2; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { color: #424242; margin: 20px 0 10px; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
    .metadata { background: #f5f5f5; padding: 10px 15px; border-radius: 4px; margin-bottom: 20px; font-size: 0.9em; color: #666; }
    .transcript { background: #fff9c4; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: #1976d2; color: white; padding: 12px; text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #e0e0e0; }
    tr:hover { background: #f5f5f5; }
    .label { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; background: #e3f2fd; color: #1565c0; }
    .confidence { font-weight: 500; }
    .high { color: #2e7d32; }
    .medium { color: #f57c00; }
    .low { color: #d32f2f; }
  </style>
</head>
<body>
  <h1>OR-SST Extraction Report</h1>
  <div class="metadata">
    <strong>Generated:</strong> ${new Date().toLocaleString()} | 
    <strong>Version:</strong> ${data.metadata.version || '1.0'}
  </div>
  
  <h2>Transcript</h2>
  <div class="transcript">${this.escapeHTML(data.transcript) || 'No transcript available'}</div>
  
  ${Object.keys(flatData).length > 0 ? `
  <h2>Extracted Information</h2>
  <table>
    <thead>
      <tr><th>Field</th><th>Value</th></tr>
    </thead>
    <tbody>
      ${Object.entries(flatData)
        .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'false')
        .map(([k, v]) => `<tr><td><strong>${this.formatFieldName(k)}</strong></td><td>${this.escapeHTML(v)}</td></tr>`)
        .join('')}
    </tbody>
  </table>` : ''}
  
  ${entities.length > 0 ? `
  <h2>Raw Entities (${entities.length})</h2>
  <table>
    <thead>
      <tr><th>Entity</th><th>Label</th><th>Confidence</th><th>Position</th></tr>
    </thead>
    <tbody>
      ${entities.map(e => `
      <tr>
        <td>${this.escapeHTML(e.word)}</td>
        <td><span class="label">${e.label}</span></td>
        <td class="confidence ${this.getConfidenceClass(e.confidence)}">${e.confidence}%</td>
        <td>${e.start}-${e.end}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}
</body>
</html>`;

    return new Blob([html], { type: this.getMimeType() });
  }

  formatFieldName(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  getConfidenceClass(confidence) {
    const val = parseFloat(confidence);
    if (val >= 80) return 'high';
    if (val >= 50) return 'medium';
    return 'low';
  }

  getExtension() {
    return 'html';
  }

  getMimeType() {
    return 'text/html;charset=utf-8';
  }

  getDisplayName() {
    return 'HTML Report';
  }
}

// ============================================================================
// Export Service (Registry Pattern)
// ============================================================================

class ExportService {
  constructor() {
    this.exporters = new Map();
  }

  /**
   * Register a new exporter
   * @param {string} type - Export type identifier
   * @param {typeof BaseExporter} ExporterClass - Exporter class
   * @param {Object} defaultOptions - Default options for this exporter
   */
  register(type, ExporterClass, defaultOptions = {}) {
    this.exporters.set(type, { ExporterClass, defaultOptions });
  }

  /**
   * Get available export types
   * @returns {Array<{type: string, displayName: string, extension: string}>}
   */
  getAvailableTypes() {
    const types = [];
    for (const [type, { ExporterClass, defaultOptions }] of this.exporters) {
      const exporter = new ExporterClass(defaultOptions);
      types.push({
        type,
        displayName: exporter.getDisplayName(),
        extension: exporter.getExtension(),
        mimeType: exporter.getMimeType()
      });
    }
    return types;
  }

  /**
   * Create an exporter instance
   * @param {string} type - Export type
   * @param {Object} options - Override options
   * @returns {BaseExporter}
   */
  createExporter(type, options = {}) {
    const config = this.exporters.get(type);
    if (!config) {
      throw new Error(`Unknown export type: ${type}. Available: ${[...this.exporters.keys()].join(', ')}`);
    }
    return new config.ExporterClass({ ...config.defaultOptions, ...options });
  }

  /**
   * Export data using specified type
   * @param {string} type - Export type
   * @param {Object} rawData - Raw data object
   * @param {Object} options - Export options
   * @returns {Blob}
   */
  export(type, rawData, options = {}) {
    const exporter = this.createExporter(type, options);
    const data = new ExportData(rawData);
    return exporter.export(data);
  }

  /**
   * Download exported data
   * @param {string} type - Export type
   * @param {Object} rawData - Raw data object
   * @param {string} filename - Base filename
   * @param {Object} options - Export options
   */
  download(type, rawData, filename = 'or-extraction', options = {}) {
    const exporter = this.createExporter(type, options);
    const data = new ExportData(rawData);
    exporter.download(data, `${filename}-${Date.now()}`);
  }

  /**
   * Check if export type is available
   * @param {string} type - Export type
   * @returns {boolean}
   */
  hasType(type) {
    return this.exporters.has(type);
  }
}

// ============================================================================
// Default Export Service Instance
// ============================================================================

const exportService = new ExportService();

// Register default exporters
exportService.register('json', JSONExporter);
exportService.register('csv', CSVExporter);
exportService.register('excel', ExcelExporter);
exportService.register('text', TextReportExporter);
exportService.register('html', HTMLReportExporter);

// ============================================================================
// Exports
// ============================================================================

export {
  ExportService,
  ExportData,
  BaseExporter,
  JSONExporter,
  CSVExporter,
  ExcelExporter,
  TextReportExporter,
  HTMLReportExporter
};

export default exportService;
