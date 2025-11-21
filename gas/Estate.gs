// 不動産データモデル定義

// 定数定義
const BuildingType = {
  WOOD: '木',
  RC: '鉄筋コンクリート',
  SRC: '鉄骨鉄筋コンクリート',
  LGS: '軽量鉄骨',
  HGS: '重量鉄骨',
  UNKNOWN: '不明',
};

const LoanPayType = {
  LEVEL: '元利均等返済',
  PRINCIPAL: '元金均等返済',
};

const initialKeys = [
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
  "ln_init_amount"
];

const yearlyInputKeys = [
  "et_years",
  "bd_rent_income",
  "bd_empty_ratio",
  "et_surface_ratio",
  "bd_tax_account_price",
  "bd_tax_eval_price",
  "ld_tax_account_price",
  "ld_tax_eval_price",
  "ln_debt_all_last",
  "ln_ratio",
  "ln_monthes",
  "ln_payment_type",
  "bd_ad_fee_ratio",
  "bd_maintenance_fee",
  "bd_repair_cost",
  "et_last_net_amount",
  "bd_empty_ratio_on_sell",
  "et_surface_ratio_on_sell",
  "bd_sale_deduction_amount",
];

const ratioKeys = [
  "et_surface_ratio",
  "et_net_ratio_",
  "et_surface_ratio_all_",
  "et_net_ratio_all_",
  "bd_empty_ratio",
  "ln_ratio",
  "bd_ad_fee_ratio",
];

const buldingFieldNames = [
  "bd_reg_cost",
  "bd_init_reform_cost",
  "bd_price",
  "bd_remove_leaves_cost",
  "bd_room_count",
  "bd_leaves_on_purchase",
  "bd_type",
  "bd_lifespan",
  "bd_lifespan_now",
  "bd_ld_bd_ratio"
];

const buildingInfoFieldNames = [
  "bd_tax_account_price",
  "bd_tax_eval_price",
  "bd_empty_ratio",
  "bd_empty_ratio_on_sell",
  "bd_repair_cost",
  "bd_ad_fee_ratio",
  "bd_rent_income",
  "bd_maintenance_fee",
  "bd_sale_deduction_amount"
];

const landFieldNames = [
  "ld_reg_cost",
  "ld_price"
];

const landInfoFieldNames = [
  "ld_tax_eval_price",
  "ld_tax_account_price"
];

const loanFieldNames = [
  "ln_init_amount",
  "ln_debt_payment_all_first"
];

const loanInfoFieldNames = [
  "ln_monthes",
  "ln_payment_type",
  "ln_ratio",
  "ln_debt_all_last"
];

const estateFieldNames = [
  "et_years",
  "et_surface_ratio",
  "et_surface_ratio_on_sell",
  "et_last_net_amount"
];

/**
 * ヘルパー関数
 */
function getBuildingLifespan(type) {
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
}

function calculateBuildingLifespanNow(leavesOnPurchase, lifespan) {
  if (leavesOnPurchase <= 0) {
    return lifespan;
  } else if (lifespan <= leavesOnPurchase) {
    return 2;
  } else {
    return Math.max(
      Math.floor((lifespan - leavesOnPurchase) + leavesOnPurchase * 0.2),
      2
    );
  }
}

/**
 * セルデータからパース（zodなしの簡易版）
 */
function parseFromCellData(cells, fieldNames, defaults) {
  const data = Object.assign({}, defaults);
  const remainingCells = [];
  const errors = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (fieldNames.indexOf(cell.key) === -1) {
      remainingCells.push(cell);
      continue;
    }
    
    const cellValue = cell.value ? cell.value.toString().replace(/,/g, '') : '';
    if (cellValue !== '') {
      const numValue = parseFloat(cellValue);
      if (!isNaN(numValue)) {
        data[cell.key] = numValue;
      } else {
        data[cell.key] = cellValue;
      }
    }
  }
  
  return { data: data, errors: errors, remainingCells: remainingCells };
}

/**
 * Building データのデフォルト値と検証
 */
function createBuilding(data) {
  const building = {
    bd_reg_cost: data.bd_reg_cost !== undefined ? data.bd_reg_cost : 80000,
    bd_init_reform_cost: data.bd_init_reform_cost !== undefined ? data.bd_init_reform_cost : 0,
    bd_price: data.bd_price !== undefined ? data.bd_price : null,
    bd_remove_leaves_cost: data.bd_remove_leaves_cost !== undefined ? data.bd_remove_leaves_cost : 0,
    bd_room_count: data.bd_room_count !== undefined ? data.bd_room_count : 1,
    bd_leaves_on_purchase: data.bd_leaves_on_purchase !== undefined ? data.bd_leaves_on_purchase : 0,
    bd_type: data.bd_type !== undefined ? data.bd_type : BuildingType.UNKNOWN,
    bd_lifespan: data.bd_lifespan !== undefined ? data.bd_lifespan : 47,
    bd_lifespan_now: data.bd_lifespan_now !== undefined ? data.bd_lifespan_now : null,
    bd_ld_bd_ratio: data.bd_ld_bd_ratio !== undefined ? data.bd_ld_bd_ratio : 1
  };
  
  // 検証とデフォルト値設定
  if (building.bd_reg_cost < 0) building.bd_reg_cost = 0;
  if (building.bd_init_reform_cost < 0) building.bd_init_reform_cost = 0;
  if (building.bd_price !== null && building.bd_price <= 0) building.bd_price = 0;
  if (building.bd_remove_leaves_cost < 0) building.bd_remove_leaves_cost = 0;
  if (building.bd_room_count <= 0) building.bd_room_count = 1;
  if (building.bd_leaves_on_purchase < 0) building.bd_leaves_on_purchase = 0;
  
  if (building.bd_lifespan <= 0) {
    building.bd_lifespan = getBuildingLifespan(building.bd_type);
  }
  
  if (building.bd_lifespan_now === null || building.bd_lifespan_now <= 2) {
    building.bd_lifespan_now = calculateBuildingLifespanNow(
      building.bd_leaves_on_purchase,
      building.bd_lifespan
    );
  }
  
  return building;
}

/**
 * BuildingInfo データのデフォルト値と検証
 */
function createBuildingInfo(data) {
  const bdInfo = {
    bd_tax_account_price: data.bd_tax_account_price !== undefined ? data.bd_tax_account_price : null,
    bd_tax_eval_price: data.bd_tax_eval_price !== undefined ? data.bd_tax_eval_price : null,
    bd_empty_ratio: data.bd_empty_ratio !== undefined ? data.bd_empty_ratio : null,
    bd_empty_ratio_on_sell: data.bd_empty_ratio_on_sell !== undefined ? data.bd_empty_ratio_on_sell : null,
    bd_repair_cost: data.bd_repair_cost !== undefined ? data.bd_repair_cost : 0,
    bd_ad_fee_ratio: data.bd_ad_fee_ratio !== undefined ? data.bd_ad_fee_ratio : 0,
    bd_rent_income: data.bd_rent_income !== undefined ? data.bd_rent_income : null,
    bd_maintenance_fee: data.bd_maintenance_fee !== undefined ? data.bd_maintenance_fee : null,
    bd_sale_deduction_amount: data.bd_sale_deduction_amount !== undefined ? data.bd_sale_deduction_amount : 0
  };
  
  if (bdInfo.bd_tax_account_price !== null && bdInfo.bd_tax_account_price < 0) {
    bdInfo.bd_tax_account_price = 0;
  }
  if (bdInfo.bd_tax_eval_price !== null && bdInfo.bd_tax_eval_price < 0) {
    bdInfo.bd_tax_eval_price = 0;
  }
  if (bdInfo.bd_tax_eval_price === null && bdInfo.bd_tax_account_price !== null) {
    bdInfo.bd_tax_eval_price = bdInfo.bd_tax_account_price;
  }
  
  if (bdInfo.bd_empty_ratio !== null && bdInfo.bd_empty_ratio < 0) {
    bdInfo.bd_empty_ratio = 0;
  }
  if (bdInfo.bd_empty_ratio_on_sell !== null && bdInfo.bd_empty_ratio_on_sell < 0) {
    bdInfo.bd_empty_ratio_on_sell = 0;
  }
  if (bdInfo.bd_empty_ratio_on_sell === null && bdInfo.bd_empty_ratio !== null) {
    bdInfo.bd_empty_ratio_on_sell = bdInfo.bd_empty_ratio;
  }
  
  if (bdInfo.bd_repair_cost < 0) bdInfo.bd_repair_cost = 0;
  if (bdInfo.bd_ad_fee_ratio < 0) bdInfo.bd_ad_fee_ratio = 0;
  if (bdInfo.bd_rent_income !== null && bdInfo.bd_rent_income < 0) {
    bdInfo.bd_rent_income = null;
  }
  if (bdInfo.bd_maintenance_fee !== null && bdInfo.bd_maintenance_fee < 0) {
    bdInfo.bd_maintenance_fee = null;
  }
  
  return bdInfo;
}

/**
 * Land データのデフォルト値と検証
 */
function createLand(data) {
  const land = {
    ld_reg_cost: data.ld_reg_cost !== undefined ? data.ld_reg_cost : 80000,
    ld_price: data.ld_price !== undefined ? data.ld_price : null
  };
  
  if (land.ld_reg_cost < 0) land.ld_reg_cost = 0;
  if (land.ld_price !== null && land.ld_price <= 0) land.ld_price = 0;
  
  return land;
}

/**
 * LandInfo データのデフォルト値と検証
 */
function createLandInfo(data) {
  const landInfo = {
    ld_tax_eval_price: data.ld_tax_eval_price !== undefined ? data.ld_tax_eval_price : null,
    ld_tax_account_price: data.ld_tax_account_price !== undefined ? data.ld_tax_account_price : null
  };
  
  if (landInfo.ld_tax_eval_price !== null && landInfo.ld_tax_eval_price < 0) {
    landInfo.ld_tax_eval_price = null;
  }
  if (landInfo.ld_tax_account_price !== null && landInfo.ld_tax_account_price < 0) {
    landInfo.ld_tax_account_price = null;
  }
  
  return landInfo;
}

/**
 * Loan データのデフォルト値と検証
 */
function createLoan(data) {
  const loan = {
    ln_init_amount: data.ln_init_amount !== undefined ? data.ln_init_amount : 0,
    ln_debt_payment_all_first: data.ln_debt_payment_all_first !== undefined ? data.ln_debt_payment_all_first : 0
  };
  
  if (loan.ln_init_amount < 0) loan.ln_init_amount = 0;
  
  return loan;
}

/**
 * LoanInfo データのデフォルト値と検証
 */
function createLoanInfo(data) {
  const loanInfo = {
    ln_monthes: data.ln_monthes !== undefined ? data.ln_monthes : 20 * 12,
    ln_payment_type: data.ln_payment_type !== undefined ? data.ln_payment_type : LoanPayType.PRINCIPAL,
    ln_ratio: data.ln_ratio !== undefined ? data.ln_ratio : 0.02,
    ln_debt_all_last: data.ln_debt_all_last !== undefined ? data.ln_debt_all_last : null
  };
  
  if (loanInfo.ln_monthes < 0) loanInfo.ln_monthes = 20 * 12;
  if (loanInfo.ln_ratio < 0) loanInfo.ln_ratio = 0.02;
  
  return loanInfo;
}

/**
 * Estate データのデフォルト値と検証
 */
function createEstate(data) {
  const estate = {
    et_years: data.et_years !== undefined ? data.et_years : 1,
    et_surface_ratio: data.et_surface_ratio !== undefined ? data.et_surface_ratio : null,
    et_surface_ratio_on_sell: data.et_surface_ratio_on_sell !== undefined ? data.et_surface_ratio_on_sell : null,
    et_last_net_amount: data.et_last_net_amount !== undefined ? data.et_last_net_amount : 0
  };
  
  if (estate.et_years < 0) estate.et_years = 1;
  if (estate.et_surface_ratio_on_sell === null && estate.et_surface_ratio !== null) {
    estate.et_surface_ratio_on_sell = estate.et_surface_ratio;
  }
  
  return estate;
}
