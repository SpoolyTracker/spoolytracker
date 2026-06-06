import { Injectable } from '@nestjs/common';

interface MaterialData {
  id: number;
  label: string;
  density: number;
  filled: boolean;
}

interface BrandData {
  id: number;
  label: string;
}

interface DiameterData {
  id: number;
  label: string;
  value: number;
}

@Injectable()
export class TigerTagService {
  private materialsCache: Map<number, MaterialData> = new Map();
  private brandsCache: Map<number, BrandData> = new Map();
  private diametersCache: Map<number, DiameterData> = new Map();

  async getMaterialLabel(id: number): Promise<string> {
    if (!this.materialsCache.has(id)) {
      await this.loadMaterials();
    }
    return this.materialsCache.get(id)?.label || `Material ${id}`;
  }

  async getBrandLabel(id: number): Promise<string> {
    if (!this.brandsCache.has(id)) {
      await this.loadBrands();
    }
    return this.brandsCache.get(id)?.label || `Brand ${id}`;
  }

  async getDiameterLabel(id: number): Promise<string> {
    if (!this.diametersCache.has(id)) {
      await this.loadDiameters();
    }
    const diameter = this.diametersCache.get(id);
    return diameter ? `${diameter.value}mm` : `${id}`;
  }

  private async loadMaterials(): Promise<void> {
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/TigerTag-Project/TigerTag-RFID-Guide/main/database/id_material.json',
      );
      const materials: MaterialData[] = await response.json();
      materials.forEach((m) => this.materialsCache.set(m.id, m));
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  }

  private async loadBrands(): Promise<void> {
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/TigerTag-Project/TigerTag-RFID-Guide/main/database/id_brand.json',
      );
      const brands: BrandData[] = await response.json();
      brands.forEach((b) => this.brandsCache.set(b.id, b));
    } catch (error) {
      console.error('Failed to load brands:', error);
    }
  }

  private async loadDiameters(): Promise<void> {
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/TigerTag-Project/TigerTag-RFID-Guide/main/database/id_diameter.json',
      );
      const diameters: DiameterData[] = await response.json();
      diameters.forEach((d) => this.diametersCache.set(d.id, d));
    } catch (error) {
      console.error('Failed to load diameters:', error);
    }
  }

  // Decode TigerTag IDs to human-readable values
  async decodeTigerTag(data: any): Promise<any> {
    const decoded: any = { ...data };

    if (data.materialId) {
      decoded.materialLabel = await this.getMaterialLabel(data.materialId);
    }

    if (data.brandId) {
      decoded.brandLabel = await this.getBrandLabel(data.brandId);
    }

    if (data.diameter) {
      decoded.diameterLabel = await this.getDiameterLabel(data.diameter);
    }

    return decoded;
  }
}
