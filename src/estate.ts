import { z } from 'zod';
import { CellByRow } from './apiTypes';

// BuildingType Enum
export enum BuildingType {
  WOOD = '木',
  RC = '鉄筋コンクリート',
  SRC = '鉄骨鉄筋コンクリート',
  LGS = '軽量鉄骨',
  HGS = '重量鉄骨',
  UNKNOWN = '不明',
}


export const getBuildingLifespan = (type: BuildingType): number => {
  switch (type) {
    case BuildingType.WOOD:
      return 22;
    case BuildingType.RC:
      return 47;
    case BuildingType.SRC:
      return 47;
    case BuildingType.LGS:
      return 27;
    case BuildingType.HGS:
      return 34;
    default:
      return 47;
  }
};

// LoanType Enum
export enum LoanType {
  ADJUSTABLE = '変動金利',
  FIXED = '固定金利',
}

// LoanPayType Enum
export enum LoanPayType {
  LEVEL = '元利均等返済',
  PRINCIPAL = '元金均等返済',
}

// Building Schema
const buldingSchema = {
  bd_reg_cost: z.number().default(80000).describe('建物登記費用'),
  bd_init_reform_cost: z.number().default(0).describe('初期リフォーム費用'),
  bd_price: z.number().nullable().default(null).describe('物件価格'),
  bd_remove_leaves_cost: z.number().default(0).describe('残置物撤去費用'),
  bd_room_count: z.number().int().default(1).describe('部屋数'),
  bd_leaves_on_purchase: z.number().int().default(0).describe('購入時築年数'),
  bd_type: z.enum(Object.values(BuildingType)).default(BuildingType.UNKNOWN).describe('造り'),
  bd_lifespan: z.number().int().default(47).describe('法定耐用年数'),
  bd_lifespan_now: z.number().nullable().default(null).describe('耐用年数'),
  bd_ld_bd_ratio: z.number().default(1).describe('土地建物比率'),
}
export const buldingFieldNames = Object.keys(buldingSchema);
export const BuildingSchema = z.object(buldingSchema).transform((data) => {
  // Validation and normalization
  if (data.bd_reg_cost < 0) data.bd_reg_cost = 0;
  if (data.bd_init_reform_cost < 0) data.bd_init_reform_cost = 0;
  if (data.bd_price !== null && data.bd_price <= 0) data.bd_price = 0;
  if (data.bd_remove_leaves_cost < 0) data.bd_remove_leaves_cost = 0;
  if (data.bd_room_count <= 0) data.bd_room_count = 1;
  if (data.bd_leaves_on_purchase < 0) data.bd_leaves_on_purchase = 0;
  
  if (data.bd_lifespan <= 0) {
    data.bd_lifespan = getBuildingLifespan(data.bd_type);
  }
  
  if (data.bd_lifespan_now === null || data.bd_lifespan_now <= 2) {
    data.bd_lifespan_now = calculateBuildingLifespanNow(
      data.bd_leaves_on_purchase,
      data.bd_lifespan
    );
  }
  
  return data;
});
export type Building = z.infer<typeof BuildingSchema>;


const calculateBuildingLifespanNow = (
  leavesOnPurchase: number,
  lifespan: number
): number => {
  if (leavesOnPurchase <= 0) {
    // 新築: 法定耐用年数
    return lifespan;
  } else if (lifespan <= leavesOnPurchase) {
    // 築年数が法定耐用年数を超えている場合は一律２年でいい
    return 2;
  } else {
    // 中古: （法定耐用年数ー購入時築年数）＋購入時築年数 * 0.2 or 2 と大きい方
    return Math.max(
      Math.floor((lifespan - leavesOnPurchase) + leavesOnPurchase * 0.2),
      2
    );
  }
};

// BuildingInfo Schema
const buildingInfoSchema = {
  bd_tax_account_price: z.number().nullable().default(null).describe('建物の固定資産税評価額'),
  bd_tax_eval_price: z.number().nullable().default(null).describe('建物の固定資産課税台帳登録額'),
  bd_empty_ratio: z.number().nullable().default(null).describe('空室率'),
  bd_empty_ratio_on_sell: z.number().nullable().default(null).describe('売却時空室率'),
  bd_repair_cost: z.number().default(0).describe('修繕費'),
  bd_ad_fee_ratio: z.number().default(0).describe('年間AD費用/満室時賃料'),
  bd_rent_income: z.number().nullable().default(null).describe('想定家賃'),
  bd_maintenance_fee: z.number().nullable().default(null).describe('管理費'),
  bd_sale_deduction_amount: z.number().default(0).describe('売却時控除額'),
}
export const buildingInfoFieldNames = Object.keys(buildingInfoSchema);
export const BuildingInfoSchema = z.object(buildingInfoSchema).transform((data) => {
  if (data.bd_tax_account_price !== null && data.bd_tax_account_price < 0) {
    data.bd_tax_account_price = 0;
  }
  if (data.bd_tax_eval_price !== null && data.bd_tax_eval_price < 0) {
    data.bd_tax_eval_price = 0;
  }
  if (data.bd_tax_eval_price === null && data.bd_tax_account_price !== null) {
    data.bd_tax_eval_price = data.bd_tax_account_price;
  }
  
  if (data.bd_empty_ratio !== null && data.bd_empty_ratio < 0) {
    data.bd_empty_ratio = 0;
  }
  if (data.bd_empty_ratio_on_sell !== null && data.bd_empty_ratio_on_sell < 0) {
    data.bd_empty_ratio_on_sell = 0;
  }
  if (data.bd_empty_ratio_on_sell === null && data.bd_empty_ratio !== null) {
    data.bd_empty_ratio_on_sell = data.bd_empty_ratio;
  }
  
  if (data.bd_repair_cost < 0) data.bd_repair_cost = 0;
  if (data.bd_ad_fee_ratio < 0) data.bd_ad_fee_ratio = 0;
  if (data.bd_rent_income !== null && data.bd_rent_income < 0) {
    data.bd_rent_income = null;
  }
  if (data.bd_maintenance_fee !== null && data.bd_maintenance_fee < 0) {
    data.bd_maintenance_fee = null;
  }
  
  return data;
});

export type BuildingInfo = z.infer<typeof BuildingInfoSchema>;

// Land Schema
export const landSchema = {
  ld_reg_cost: z.number().default(80000).describe('土地登記費用'),
  ld_price: z.number().nullable().default(null).describe('土地価格'),
}
export const landFieldNames = Object.keys(landSchema);
export const LandSchema = z.object(landSchema).transform((data) => {
  if (data.ld_reg_cost < 0) data.ld_reg_cost = 0;
  if (data.ld_price !== null && data.ld_price <= 0) data.ld_price = 0;
  return data;
});
export type Land = z.infer<typeof LandSchema>;

// LandInfo Schema
const landInfoSchema = {
  ld_tax_eval_price: z.number().nullable().default(null).describe('土地の固定資産税評価額'),
  ld_tax_account_price: z.number().nullable().default(null).describe('土地の固定資産課税台帳登録額'),
}
export const landInfoFieldNames = Object.keys(landInfoSchema);
export const LandInfoSchema = z.object(landInfoSchema).transform((data) => {
  if (data.ld_tax_eval_price !== null && data.ld_tax_eval_price < 0) {
    data.ld_tax_eval_price = null;
  }
  if (data.ld_tax_account_price !== null && data.ld_tax_account_price < 0) {
    data.ld_tax_account_price = null;
  }
  return data;
});
export type LandInfo = z.infer<typeof LandInfoSchema>;

// Loan Schema
const locanSchema = {
  ln_init_amount: z.number().default(0).describe('頭金'),
  ln_debt_payment_all_first: z.number().default(0).describe('頭金'),
}
export const loanFieldNames = Object.keys(locanSchema);
export const LoanSchema = z.object(locanSchema).transform((data) => {
  if (data.ln_init_amount < 0) data.ln_init_amount = 0;
  return data;
});
export type Loan = z.infer<typeof LoanSchema>;

const locanInfoSchema = {
  ln_monthes: z.number().int().default(20 * 12).describe('返済月数'),
  ln_payment_type: z.enum(Object.values(LoanPayType)).default(LoanPayType.PRINCIPAL).describe('返済方式'),
  ln_ratio: z.number().default(0.02).describe('利率'),
  ln_debt_all_last: z.number().nullable().default(null).describe('前期末ローン残高'),
}
export const loanInfoFieldNames = Object.keys(locanInfoSchema);
export const LoanInfoSchema = z.object(locanInfoSchema).transform((data) => {
  if (data.ln_monthes < 0) data.ln_monthes = 20 * 12;
  if (data.ln_ratio < 0) data.ln_ratio = 0.02;
  return data;
});
export type LoanInfo = z.infer<typeof LoanInfoSchema>;

// Estate Schema
const estateSchema = {
  et_years: z.number().int().default(1).describe('購入後経過年数'),
  et_surface_ratio: z.number().nullable().default(null).describe('表面利回り'),
  et_surface_ratio_on_sell: z.number().nullable().default(null).describe('売却時表面利回り'),
  et_last_net_amount: z.number().nullable().default(0).describe('前期末累計収支'),
}
export const estateFieldNames = Object.keys(estateSchema);
export const EstateSchema = z.object(estateSchema).transform((data) => {
  if (data.et_years < 0) data.et_years = 1;
  if (data.et_surface_ratio_on_sell === null && data.et_surface_ratio !== null) {
    data.et_surface_ratio_on_sell = data.et_surface_ratio;
  }
  return data;
});
export type Estate = z.infer<typeof EstateSchema>;

export const allDataFieldNames = [
  ...buldingFieldNames,
  ...buildingInfoFieldNames,
  ...landFieldNames,
  ...landInfoFieldNames,
  ...loanFieldNames,
  ...loanInfoFieldNames,
  ...estateFieldNames,
]
export const initialDataFieldNames =[
  "bd_price",
  "ld_price",
  "bd_ld_bd_ratio",
  "bd_room_count",
  "bd_leaves_on_purchase",
  "bd_type",
  "bd_lifespan",
  "bd_lifespan_now",
  "bd_init_reform_cost",
  "bd_remove_leaves_cost",
  "bd_reg_cost",
  "ld_reg_cost",
  "ln_init_amount"]
export const yearlyDataFieldNames = allDataFieldNames.filter(item => !initialDataFieldNames.includes(item));
// Helper function to parse from cell data (similar to from_cell_data in Python)
export const parseFromCellData = <T>(
  schema: z.ZodSchema<T>,
  cells: CellByRow[],
  fieldNames: string[],
): { data: T | null; errors: string[]; remainingCells: CellByRow[] } => {
  const data: Record<string, any> = {};
  const remainingCells: CellByRow[] = [];

  for (const cell of cells) {
    if (!fieldNames.includes(cell.key)) {
      remainingCells.push(cell);
      continue;
    }
    
    const cellValue = cell.value?.replace(/,/g, '') || '';
    if (cellValue !== '') {
      // Try to parse as number if possible
      const numValue = parseFloat(cellValue);
      if (!isNaN(numValue)) {
        data[cell.key] = numValue;
      } else {
        data[cell.key] = cellValue;
      }
    }
  }
  
  try {
    const result = schema.parse(data);
    return { data: result, errors: [], remainingCells };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorFields = error.issues.map((issue: z.ZodIssue) => issue.path.join('.'));
      return { data: null, errors: errorFields, remainingCells };
    }
    return { data: null, errors: ['Unknown error'], remainingCells };
  }
};
