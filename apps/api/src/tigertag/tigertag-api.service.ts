import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

const TIGERTAG_API_BASE = 'https://api.tigertag.io/api:tigertag';

export interface TigerBrand {
  id: number;
  name: string; // API returns 'name', not 'label'
  label?: string;
}

export interface TigerMaterial {
  id: number;
  label: string;
  name?: string;
}

export interface TigerAspect {
  id: number;
  label: string;
  name?: string;
}

@Injectable()
export class TigerTagApiService {
  /**
   * Fetch all brands from TigerTag API
   */
  async fetchBrands(): Promise<TigerBrand[]> {
    try {
      const response = await axios.get(`${TIGERTAG_API_BASE}/brand/get/all`, {
        params: { light: true },
      });
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Failed to fetch brands from TigerTag API',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Fetch all materials from TigerTag API
   */
  async fetchMaterials(): Promise<TigerMaterial[]> {
    try {
      const response = await axios.get(
        `${TIGERTAG_API_BASE}/material/get/all`,
        {
          params: { light: true },
        },
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Failed to fetch materials from TigerTag API',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Fetch all aspects (types/characteristics) from TigerTag API
   */
  async fetchAspects(): Promise<TigerAspect[]> {
    try {
      const response = await axios.get(`${TIGERTAG_API_BASE}/aspect/get/all`);
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Failed to fetch aspects from TigerTag API',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Fetch enriched product info from TigerTag API
   */
  async fetchProductInfo(params: {
    brandId: number;
    materialId: number;
    typeId?: number;
    diameterId?: number;
    aspect1Id?: number;
    aspect2Id?: number;
    measureId?: number;
    lang?: string;
  }): Promise<any> {
    try {
      const response = await axios.post(
        `${TIGERTAG_API_BASE}/product/filament/get_infos`,
        {
          brand_id: params.brandId,
          material_id: params.materialId,
          type_id: params.typeId || 0,
          diameter_id: params.diameterId || 1, // Default 1.75mm
          aspect1_id: params.aspect1Id || 0,
          aspect2_id: params.aspect2Id || 0,
          measure_id: params.measureId || 1,
          lang: params.lang || 'en',
        },
      );
      return response.data;
    } catch (error) {
      // Non-critical, return null if enrichment fails
      return null;
    }
  }
}
