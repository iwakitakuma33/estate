// 方程式定義部分

/**
 * 価格方程式
 */
function equationsPrice() {
  const vDict = {};
  
  vDict['bd_empty_ratio'] = null;
  vDict['bd_ld_bd_ratio'] = null;
  vDict['ld_price'] = null;
  vDict['et_price_all_'] = 'bd_price + ld_price';
  vDict['bd_rent_income'] = null;
  vDict['bd_full_rent_yearly_'] = 'bd_rent_income * bd_room_count * 12';
  vDict['bd_rent_yearly_'] = 'bd_full_rent_yearly_ * (1 - bd_empty_ratio)';
  vDict['et_surface_ratio'] = null;
  vDict['bd_price'] = 'ld_price * bd_ld_bd_ratio';
  
  return vDict;
}

/**
 * 初期費用方程式
 */
function equationsInitCost(building, bdInfo, land, landInfo, estate) {
  const vDict = {};
  
  vDict['bd_empty_ratio'] = null;
  vDict['bd_ld_bd_ratio'] = null;
  vDict['ld_price'] = null;
  vDict['et_price_all_'] = 'bd_price + ld_price';
  vDict['et_years'] = null;
  vDict['bd_room_count'] = null;
  vDict['bd_leaves_on_purchase'] = null;
  vDict['bd_lifespan'] = null;
  vDict['bd_lifespan_now'] = null;
  vDict['bd_reg_cost'] = null;
  vDict['bd_init_reform_cost'] = null;
  vDict['bd_remove_leaves_cost'] = null;
  vDict['ld_reg_cost'] = null;
  
  let value = null;
  if (building.bd_price === null && land.ld_price === null) {
    value = 'ld_price * bd_ld_bd_ratio';
  }
  vDict['bd_price'] = value;
  
  vDict['et_purchase_fee_'] = 'et_price_all_ * 0.03 + 60000';
  
  if (bdInfo.bd_tax_eval_price !== null) {
    value = null;
  } else if (bdInfo.bd_tax_account_price !== null) {
    bdInfo.bd_tax_eval_price = bdInfo.bd_tax_account_price;
    value = null;
  } else {
    value = 'bd_tax_account_price';
  }
  vDict['bd_tax_eval_price'] = value;
  
  if (bdInfo.bd_tax_account_price === null) {
    const ratio = Math.max(
      (building.bd_lifespan - estate.et_years - building.bd_leaves_on_purchase) / building.bd_lifespan,
      0.2
    );
    value = 'bd_price * 0.6 * ' + ratio;
  } else {
    value = null;
  }
  vDict['bd_tax_account_price'] = value;
  
  if (landInfo.ld_tax_eval_price !== null) {
    value = null;
  } else {
    value = 'ld_price * 0.7 / 1.1';
  }
  vDict['ld_tax_eval_price'] = value;
  
  if (landInfo.ld_tax_account_price !== null) {
    value = null;
  } else {
    value = 'ld_tax_eval_price';
  }
  vDict['ld_tax_account_price'] = value;
  
  vDict['ld_reg_tax_'] = 'ld_tax_eval_price * 0.015';
  vDict['ld_purchase_tax_'] = 'ld_tax_account_price * 0.03';
  vDict['bd_reg_tax_'] = 'bd_tax_account_price * 0.02';
  vDict['bd_purchase_tax_'] = 'bd_tax_eval_price * 0.03';
  vDict['et_fixed_assets_tax_'] = '( ld_tax_eval_price + bd_tax_eval_price ) * 0.014';
  vDict['et_city_plan_tax_'] = '( ld_tax_eval_price + bd_tax_eval_price ) * 0.003';
  vDict['et_init_cost_all_'] = 'et_init_cost_ + et_init_tax_';
  vDict['et_debt_all_'] = 'et_init_cost_all_';
  vDict['ln_init_amount'] = null;
  vDict['et_debt_'] = 'et_debt_all_ - ln_init_amount';
  vDict['et_init_cashout_'] = 'et_init_cost_all_ + ln_init_amount';
  vDict['et_init_cashin_'] = 'et_debt_';
  vDict['et_init_cashnet_'] = 'et_init_cashin_ - et_init_cashout_';
  vDict['et_init_cost_'] = 'bd_reg_cost + bd_price + bd_init_reform_cost + bd_remove_leaves_cost + ld_reg_cost + ld_price + et_purchase_fee_';
  vDict['et_init_tax_'] = 'ld_reg_tax_ + bd_reg_tax_ + ld_purchase_tax_ + bd_purchase_tax_';
  
  return [vDict, [], building, bdInfo, land, landInfo, estate];
}

/**
 * ローン方程式
 */
function equationsLoan(etDebt, loanInfo, estate) {
  const vDict = {};
  
  vDict['ln_ratio'] = null;
  vDict['ln_monthes'] = null;
  
  if (loanInfo.ln_debt_all_last === null) {
    loanInfo.ln_debt_all_last = etDebt;
  } else if (loanInfo.ln_debt_all_last > etDebt) {
    loanInfo.ln_debt_all_last = etDebt;
  }
  vDict['ln_debt_all_last'] = String(loanInfo.ln_debt_all_last);
  
  const leaveMonthes = Math.max(loanInfo.ln_monthes - (estate.et_years - 1) * 12, 0);
  vDict['leave_monthes_'] = String(leaveMonthes);
  
  let etLeaveDebtStart = loanInfo.ln_debt_all_last;
  let yearlyPrincipalPaid = 0;
  
  if (loanInfo.ln_payment_type === LoanPayType.PRINCIPAL) {
    const principalRepaymentPerMonth = etDebt / loanInfo.ln_monthes;
    const leaveMonthesInYear = Math.min(leaveMonthes, 12);
    yearlyPrincipalPaid = principalRepaymentPerMonth * leaveMonthesInYear;
    vDict['et_principal_repayment_'] = String(yearlyPrincipalPaid);
    
    let interestPaid = 0;
    let _etLeaveDebtStart = etLeaveDebtStart;
    for (let i = 0; i < leaveMonthesInYear; i++) {
      const interest = _etLeaveDebtStart * loanInfo.ln_ratio / 12;
      _etLeaveDebtStart = _etLeaveDebtStart - principalRepaymentPerMonth;
      interestPaid += interest;
    }
    vDict['et_interest_paid_'] = String(interestPaid);
  } else {
    const breakdown = calculateYearlyBreakdownFromCurrent(
      etLeaveDebtStart,
      loanInfo.ln_ratio,
      leaveMonthes
    );
    const yearlyInterestPaid = breakdown[1];
    yearlyPrincipalPaid = breakdown[2];
    vDict['et_principal_repayment_'] = String(yearlyPrincipalPaid);
    vDict['et_interest_paid_'] = String(yearlyInterestPaid);
  }
  
  vDict['et_repayment_'] = 'et_principal_repayment_ + et_interest_paid_';
  
  let et_leave_debt_end_ = etLeaveDebtStart - yearlyPrincipalPaid;
  if (et_leave_debt_end_ < 100) {
    et_leave_debt_end_ = 0;
  }
  vDict['et_leave_debt_end_'] = String(et_leave_debt_end_);
  
  return [vDict, [], loanInfo, estate];
}

/**
 * 年次ローン計算
 */
function calculateYearlyBreakdownFromCurrent(currentBalance, annualInterestRate, remainingMonths) {
  const monthlyInterestRate = annualInterestRate / 12;
  
  if (remainingMonths <= 0) {
    return [0, 0, 0];
  }
  
  let monthlyPayment;
  if (monthlyInterestRate === 0) {
    monthlyPayment = currentBalance / remainingMonths;
  } else {
    const n = remainingMonths;
    const i = monthlyInterestRate;
    const powerFactor = Math.pow(1 + i, n);
    monthlyPayment = (currentBalance * (i * powerFactor)) / (powerFactor - 1);
  }
  
  let simBalance = currentBalance;
  let yearlyInterestPaid = 0;
  let yearlyPrincipalPaid = 0;
  
  const monthsToSimulate = Math.min(12, remainingMonths);
  
  for (let month = 1; month <= monthsToSimulate; month++) {
    const interestPayment = simBalance * monthlyInterestRate;
    let principalPayment = monthlyPayment - interestPayment;
    
    if (month === remainingMonths) {
      principalPayment = simBalance;
    }
    
    simBalance -= principalPayment;
    yearlyInterestPaid += interestPayment;
    yearlyPrincipalPaid += principalPayment;
  }
  
  return [monthlyPayment, yearlyInterestPaid, yearlyPrincipalPaid];
}

/**
 * 年次方程式
 */
function equationsYearly(bdInfo, building, estate, et_taxable_income_) {
  const vDict = {};
  
  vDict['bd_rent_income'] = null;
  vDict['bd_full_rent_yearly_'] = 'bd_rent_income * bd_room_count * 12';
  vDict['bd_rent_yearly_'] = 'bd_full_rent_yearly_ * (1 - bd_empty_ratio)';
  vDict['et_surface_ratio'] = null;
  vDict['bd_ad_fee_ratio'] = null;
  vDict['bd_ad_fee_'] = 'bd_full_rent_yearly_ * bd_ad_fee_ratio';
  
  let value;
  if (bdInfo.bd_maintenance_fee !== null) {
    value = null;
  } else {
    value = 'bd_full_rent_yearly_ * 0.04';
  }
  vDict['bd_maintenance_fee'] = value;
  
  vDict['bd_repair_cost'] = null;
  vDict['et_cost_yearly_'] = 'et_interest_paid_ + bd_ad_fee_ + bd_maintenance_fee + bd_repair_cost';
  vDict['et_net_yearly_'] = 'bd_rent_yearly_ - et_cost_yearly_';
  
  const lifespanNow = building.bd_lifespan_now || getBuildingLifespan(building.bd_type);
  if (estate.et_years - 1 > lifespanNow) {
    value = '0';
  } else {
    value = String(building.bd_price / lifespanNow);
  }
  vDict['bd_depreciation_'] = value;
  
  if (et_taxable_income_ !== null) {
    value = et_taxable_income_ > 0 ? String(et_taxable_income_) : '0';
  } else {
    value = 'bd_rent_yearly_ - et_cost_yearly_ - et_fixed_assets_tax_ - et_city_plan_tax_ - bd_depreciation_';
  }
  vDict['et_taxable_income_'] = value;
  
  vDict['et_tax_'] = 'et_taxable_income_ * 0.3';
  vDict['et_tax_all_'] = 'et_fixed_assets_tax_ + et_city_plan_tax_ + et_tax_';
  vDict['et_net_amount_'] = 'et_net_yearly_ - et_tax_all_ - et_principal_repayment_';
  vDict['et_last_net_amount'] = null;
  vDict['et_net_amount_all_'] = 'et_last_net_amount + et_net_amount_';
  vDict['et_surface_ratio_all_'] = 'bd_rent_yearly_ / et_init_cashout_';
  vDict['et_net_ratio_'] = 'et_net_amount_ / et_price_all_';
  vDict['et_net_ratio_all_'] = 'et_net_amount_ / et_init_cashout_';
  
  return [vDict, [], bdInfo, building, estate];
}

/**
 * その他の方程式
 */
function equationsOther(building, estate) {
  const vDict = {};
  
  const lifespanNow = building.bd_lifespan_now || getBuildingLifespan(building.bd_type);
  let value;
  if (estate.et_years - 1 > lifespanNow) {
    value = '0';
  } else {
    value = String(lifespanNow - estate.et_years);
  }
  vDict['bd_depreciation_leaves_'] = value;
  
  vDict['bd_empty_ratio_on_sell'] = null;
  
  value = null;
  if (estate.et_surface_ratio_on_sell === null) {
    value = "et_surface_ratio";
  }
  vDict['et_surface_ratio_on_sell'] = value;
  
  return [vDict, [], building, estate];
}
