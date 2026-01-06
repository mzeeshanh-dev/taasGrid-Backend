export class MemStorage {
  constructor() {
    this.cvs = new Map();
    this.currentId = 1;
  }

  async createCv(insertCv) {
    const id = this.currentId++;
    const cv = { ...insertCv, id };
    this.cvs.set(id, cv);
    return cv;
  }

  async getCvs() {
    return Array.from(this.cvs.values());
  }

  async getCv(id) {
    return this.cvs.get(id);
  }

  async clearCvs() {
    this.cvs.clear();
    this.currentId = 1;
  }
}

export const storage = new MemStorage();
