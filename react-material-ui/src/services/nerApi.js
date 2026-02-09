// API Service for NER endpoints
const API_BASE_URL = 'http://localhost:8000/api';

class NERApiService {
  // Model Management
  static async getModels() {
    const response = await fetch(`${API_BASE_URL}/ner/models/`);
    if (!response.ok) throw new Error('Failed to fetch models');
    return response.json();
  }

  static async createModel(modelData) {
    const response = await fetch(`${API_BASE_URL}/ner/models/create/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create model');
    }
    return response.json();
  }

  static async deleteModel(modelId) {
    const response = await fetch(`${API_BASE_URL}/ner/models/delete/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: modelId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete model');
    }
    return response.json();
  }

  // Training Data Management
  static async getTrainingData() {
    const response = await fetch(`${API_BASE_URL}/ner/data/`);
    if (!response.ok) throw new Error('Failed to fetch training data');
    return response.json();
  }

  static async addTrainingEntry(tokens, tags) {
    const response = await fetch(`${API_BASE_URL}/ner/data/add/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, tags }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add entry');
    }
    return response.json();
  }

  static async updateTrainingEntry(id, tokens, tags) {
    const response = await fetch(`${API_BASE_URL}/ner/data/update/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tokens, tags }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update entry');
    }
    return response.json();
  }

  static async deleteTrainingEntry(id) {
    const response = await fetch(`${API_BASE_URL}/ner/data/delete/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete entry');
    }
    return response.json();
  }

  static async getDataStats() {
    const response = await fetch(`${API_BASE_URL}/ner/data/stats/`);
    if (!response.ok) throw new Error('Failed to fetch data statistics');
    return response.json();
  }

  // Training Management
  static async startTraining(config) {
    const response = await fetch(`${API_BASE_URL}/ner/training/start/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start training');
    }
    return response.json();
  }

  static async getTrainingStatus() {
    const response = await fetch(`${API_BASE_URL}/ner/training/status/`);
    if (!response.ok) throw new Error('Failed to fetch training status');
    return response.json();
  }

  static async stopTraining() {
    const response = await fetch(`${API_BASE_URL}/ner/training/stop/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to stop training');
    }
    return response.json();
  }
}

export default NERApiService;
