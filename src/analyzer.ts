import { create, all } from 'mathjs';
import { ColumnDataForEstate, CellByRow, KeyValueDict } from './apiTypes';
import {
  Building,
  BuildingInfo,
  Land,
  LandInfo,
  Loan,
  LoanInfo,
  Estate,
  BuildingSchema,
  BuildingInfoSchema,
  LandSchema,
  LandInfoSchema,
  LoanSchema,
  EstateSchema,
  parseFromCellData,
  LoanPayType,
  getBuildingLifespan,
  buldingFieldNames,
  buildingInfoFieldNames,
  landFieldNames,
  landInfoFieldNames,
  loanFieldNames,
  estateFieldNames,
  LoanInfoSchema,
  loanInfoFieldNames,
  initialDataFieldNames,
  
} from './estate';

const math = create(all);

interface EquationDict {
  [key: string]: string | null;
}



export class Analyser {
  static parseData(data: ColumnDataForEstate ,cells: CellByRow[]): [ColumnDataForEstate, KeyValueDict, EquationDict, string[], Building, BuildingInfo, Land, LandInfo, Loan, LoanInfo, Estate] {
    const buildingResult = parseFromCellData(
      BuildingSchema,
      cells,
      buldingFieldNames,
    );
    let building = buildingResult.data;
    let remainingCells = buildingResult.remainingCells;
    const bdInfoResult = parseFromCellData(
      BuildingInfoSchema,
      remainingCells,
      buildingInfoFieldNames,
    );
    let bdInfo = bdInfoResult.data;
    remainingCells = bdInfoResult.remainingCells;

    const landResult = parseFromCellData(
      LandSchema,
      remainingCells,
      landFieldNames,
    );
    let land = landResult.data;
    remainingCells = landResult.remainingCells;

    const landInfoResult = parseFromCellData(
      LandInfoSchema,
      remainingCells,
      landInfoFieldNames,
    );
    let landInfo = landInfoResult.data;
    remainingCells = landInfoResult.remainingCells;

    const loanResult = parseFromCellData(
      LoanSchema,
      remainingCells,
      loanFieldNames,
    );
    let loan = loanResult.data;
    remainingCells = loanResult.remainingCells;

    const loanInfoResult = parseFromCellData(
      LoanInfoSchema,
      remainingCells,
      loanInfoFieldNames,
    );
    let loanInfo = loanInfoResult.data;
    remainingCells = loanInfoResult.remainingCells;

    const estateResult = parseFromCellData(
      EstateSchema,
      remainingCells,
      estateFieldNames,
    );
    let estate = estateResult.data;

    // Collect error messages
    const messageList: string[] = [
      ...buildingResult.errors,
      ...bdInfoResult.errors,
      ...landResult.errors,
      ...landInfoResult.errors,
      ...loanResult.errors,
      ...loanInfoResult.errors,
      ...estateResult.errors,
    ];

    if (messageList.length > 0) {
      data.error_msg = messageList.join(', ');
      return [data, null,null,null,building, bdInfo, land, landInfo, loan, loanInfo, estate];
    }
    
    // Validation: 空室率、想定家賃、表面利回り(不動産価格)の検証
    const validationFields = [
      bdInfo.bd_empty_ratio,
      bdInfo.bd_rent_income,
      estate.et_surface_ratio,
    ];
    const nonNoneCount = validationFields.filter(
      (field) => field !== null
    ).length;
    let inputError = false;
    let resetEtSurfaceRatio = false;

    if (land.ld_price === null && building.bd_price === null) {
      inputError = nonNoneCount < 3;
    } else {
      if (land.ld_price !== null && building.bd_price !== null) {
        building.bd_ld_bd_ratio = building.bd_price / land.ld_price;
      } else if (land.ld_price !== null && building.bd_price === null) {
        building.bd_price = land.ld_price * building.bd_ld_bd_ratio;
      } else if (land.ld_price === null && building.bd_price !== null) {
        land.ld_price = building.bd_price / building.bd_ld_bd_ratio;
      }
      inputError = nonNoneCount < 2;
      resetEtSurfaceRatio = nonNoneCount >= 3;
    }

    if (resetEtSurfaceRatio) {
      estate.et_surface_ratio = null;
    }

    if (inputError) {
      messageList.push('空室率、想定家賃、表面利回り(不動産価格のみ)がうまく設定されていません');
      data.error_msg = messageList.join(', ');
      return [data,null,null,null,building,bdInfo,land,landInfo,loan,loanInfo,estate];
    }

    if (bdInfo.bd_empty_ratio === null) {
      bdInfo.bd_empty_ratio = 1 - (estate.et_surface_ratio * (building.bd_price + land.ld_price) / (bdInfo.bd_rent_income * building.bd_room_count * 12));
    } else if (bdInfo.bd_rent_income === null) {
      bdInfo.bd_rent_income = estate.et_surface_ratio * (building.bd_price + land.ld_price) / (building.bd_room_count * 12 * (1 - bdInfo.bd_empty_ratio))
    }
    else if (estate.et_surface_ratio === null) {
      estate.et_surface_ratio = bdInfo.bd_rent_income * building.bd_room_count * 12 * (1 - bdInfo.bd_empty_ratio) / (building.bd_price + land.ld_price);
    }

    // Solve price equations
    const [eqDictPrice] = this.equationsPrice();
    let keyVDict = this.modelDumps(building, bdInfo, loan, land, landInfo, estate, loanInfo);
    keyVDict = this.solve(eqDictPrice, keyVDict);
    building.bd_price = Number(keyVDict['bd_price']);
    land.ld_price = Number(keyVDict['ld_price']);
    keyVDict = this.modelDumps(building, bdInfo, loan, land, landInfo, estate, loanInfo);
    keyVDict = this.solve(eqDictPrice, keyVDict);
    // Initial cost calculations
    const [
      eqDictInit,
      ,
      buildingUpdated,
      bdInfoUpdated,
      landUpdated,
      landInfoUpdated,
      estateUpdated,
    ] = this.equationsInitCost(building, bdInfo, land, landInfo, estate);
    building = buildingUpdated;
    bdInfo = bdInfoUpdated;
    land = landUpdated;
    landInfo = landInfoUpdated;
    estate = estateUpdated;

    keyVDict = this.modelDumps(
      building,
      bdInfo,
      loan,
      land,
      landInfo,
      estate,
      loanInfo,
      keyVDict
    );
    keyVDict = this.solve(eqDictInit, keyVDict);
    const etDebt = Number(keyVDict['et_debt_']);
    // Build complete equation dictionary
    const eqDict: EquationDict = {};
    const eqStList: string[] = [];

    const [eqDictInit2, eqStrList1, b2, bi2, l2, li2, e2] =
      this.equationsInitCost(building, bdInfo, land, landInfo, estate);
    Object.assign(eqDict, eqDictInit2);
    eqStList.push(...eqStrList1);
    building = b2;
    bdInfo = bi2;
    land = l2;
    landInfo = li2;
    estate = e2;

    keyVDict = this.modelDumps(
      building,
      bdInfo,
      loan,
      land,
      landInfo,
      estate,
      loanInfo,
      keyVDict
    );

    const [eqDictLoan, eqStrList2, loanInfoUpdated2, estateUpdated2] = this.equationsLoan(etDebt, loanInfo, estate);
    Object.assign(eqDict, eqDictLoan);
    eqStList.push(...eqStrList2);
    loanInfo = loanInfoUpdated2;
    estate = estateUpdated2;

    let [eqDictYearly, eqStrList3, bdInfoUpdated3, buildingUpdated3, estateUpdated3] = this.equationsYearly(bdInfo, building, estate,);
    Object.assign(eqDict, eqDictYearly);
    eqStList.push(...eqStrList3);
    bdInfo = bdInfoUpdated3;
    building = buildingUpdated3;
    estate = estateUpdated3;

    let [eqDictOther, eqStrList4, buildingUpdated4, estateUpdated4] =
      this.equationsOther(building, estate);
    Object.assign(eqDict, eqDictOther);
    eqStList.push(...eqStrList4);
    building = buildingUpdated4;
    estate = estateUpdated4;
    let _keyVDict = this.solve(eqDict, keyVDict);

    let [eqDictYearly2, eqStrList5, bdInfoUpdated5, buildingUpdated5, estateUpdated5] = this.equationsYearly(bdInfo, building, estate, Number(_keyVDict['et_taxable_income_']));
    Object.assign(eqDict, eqDictYearly2);
    bdInfo = bdInfoUpdated5;
    building = buildingUpdated5;
    estate = estateUpdated5;

    let [eqDictOther2, eqStrList6, buildingUpdated6, estateUpdated6] =
      this.equationsOther(building, estate);
    Object.assign(eqDict, eqDictOther);
    building = buildingUpdated6;
    estate = estateUpdated6;
    keyVDict = this.solve(eqDict, keyVDict);

    return [data, keyVDict, eqDict, eqStList, building, bdInfo, land, landInfo, loan,loanInfo, estate];
  }
  static updateData(cells: CellByRow[], keyVDict: KeyValueDict): CellByRow[] {
    for (const cell of cells) {
      if (cell.key != null && keyVDict.hasOwnProperty(cell.key) && keyVDict[cell.key] !== undefined) {
        cell.value = String(keyVDict[cell.key]);
      }
    }
    return cells;
  }
  static analyze(data: ColumnDataForEstate): ColumnDataForEstate {
    // Parse models from cell data
    let yearly_data = data.yearly_data.get("1") || [];
    const all_yearly_data = structuredClone(data.yearly_data);
    const cells = data.initial_data.concat(yearly_data);
    let [dataResult, keyVDict, eqDict, eqStList, building, bdInfo, land, landInfo, loan, loanInfo, estate] = this.parseData(data, cells);
    if (dataResult.error_msg !== null) {
      return dataResult;
    }
    data.initial_data = this.updateData(data.initial_data, keyVDict);
    data.yearly_data = new Map()
    yearly_data = this.updateData(yearly_data, keyVDict);
    const year_data_1st = structuredClone(yearly_data);
    data.yearly_data.set("1",yearly_data);
    data.output_data.set("1", {...keyVDict});
    let allYears = (loanInfo.ln_monthes / 12 ) + 3
    let yearColumnIndex = null;
    for (const cell of year_data_1st) {
      yearColumnIndex = cell.column_index
      break;
    }
    for (let year = 2; year <= allYears; year++) {
      const _yearData = structuredClone(all_yearly_data.get(String(year)) || yearly_data);
      for (const cell of _yearData) {
        cell.et_years = year;
        cell.column_index = yearColumnIndex + year - 1;
        if (cell.value == null) {
          continue
        }
        if (cell.key == "et_years") {
          cell.value = String(year);
        } 
        else if (cell.key == "ln_debt_all_last") {
          cell.value = String(keyVDict['et_leave_debt_end_']);
        } else if (cell.key == "et_last_net_amount") {
          cell.value = String(keyVDict['et_net_amount_all_']);
        }
      }
      const yearly_cells = data.initial_data.concat(_yearData);
      let [dataResultUpdated, keyVDictUpdated, eqDict, eqStList, building, bdInfo, land, landInfo, loan, loanInfo, estate] = this.parseData(data, yearly_cells);
      keyVDict["et_years"] = year;
      keyVDict = { ...keyVDict, ...keyVDictUpdated };
      data.initial_data = this.updateData(data.initial_data, keyVDict);
      yearly_data = this.updateData(_yearData, keyVDict);
      data.yearly_data.set(String(year), yearly_data);
      data.output_data.set(String(year), {...keyVDict});
    }
    return data;
  }

  static modelDumps(
    building: Building,
    bdInfo: BuildingInfo,
    loan: Loan,
    land: Land,
    landInfo: LandInfo,
    estate: Estate,
    loanInfo: LoanInfo,
    kvDict: KeyValueDict = {}
  ): KeyValueDict {
    const keyVDict: KeyValueDict = { ...kvDict };
    Object.assign(keyVDict, building);
    Object.assign(keyVDict, bdInfo);
    Object.assign(keyVDict, loan);
    Object.assign(keyVDict, land);
    Object.assign(keyVDict, landInfo);
    Object.assign(keyVDict, estate);
    Object.assign(keyVDict, loanInfo);
    return keyVDict;
  }

  static solve(eqDict: EquationDict, keyVDict: KeyValueDict): KeyValueDict {
    // Filter to only numeric and string values
    const filteredDict: KeyValueDict = {};
    const filteredDictNotNull: KeyValueDict = {};
    const scope: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(keyVDict)) {
      if ( typeof value === 'number') {
        scope[key] = value;
      }
      if (
        typeof value === 'number' ||
        typeof value === 'string' ||
        value === null
      ) {
        filteredDict[key] = value;
        if (value !== null) {
          filteredDictNotNull[key] = value;
        }
      }
    }
    const results: KeyValueDict = { ...filteredDictNotNull };
    let maxIterations = 1000;
    let iteration = 0;
    let changed = true;
    while (iteration < maxIterations) {
      iteration++;

      for (const [symbolStr, eqStr] of Object.entries(eqDict)) {
        if (eqStr === null || (symbolStr != null && results[symbolStr] !== undefined && results[symbolStr] !== null)) {
          continue;
        }
        try {
          // Try to evaluate the equation with current scope
          const result = math.evaluate(eqStr, scope);
          if (typeof result === 'number' && !isNaN(result) && result !== null) {
            results[symbolStr] = result;
            scope[symbolStr] = result;
          }
        } catch (e) {
          // console.log(e)
        }
      }
    }

    for (const [key, value] of Object.entries(filteredDict)) {
      if (!(key != null && results[key] !== undefined)) {
        results[key] = value;
      }
    }
    
    return results;
  }

  static equationsPrice(): [EquationDict, string[]] {
    const vDict: EquationDict = {};
    const eqStList: string[] = [];

    const [vDict1, eqList1] = this.equationsPriceInit();
    Object.assign(vDict, vDict1);
    eqStList.push(...eqList1);

    const [vDict2, eqList2] = this.equationsPriceYearly();
    Object.assign(vDict, vDict2);
    eqStList.push(...eqList2);

    eqStList.push('物件価格 = 指定');
    vDict['bd_price'] = 'ld_price * bd_ld_bd_ratio';

    return [vDict, eqStList];
  }

  static equationsPriceInit(): [EquationDict, string[]] {
    const vDict: EquationDict = {};
    const eqStList: string[] = [];

    eqStList.push('空室率 = 指定 or 逆算');
    vDict['bd_empty_ratio'] = null;

    eqStList.push('物件価格 / 土地価格');
    vDict['bd_ld_bd_ratio'] = null;

    eqStList.push('土地価格 = 指定');
    vDict['ld_price'] = null;

    eqStList.push('物土合計 = 物件価格 + 土地価格');
    vDict['et_price_all_'] = 'bd_price + ld_price';

    return [vDict, eqStList];
  }

  static equationsPriceYearly(): [EquationDict, string[]] {
    const vDict: EquationDict = {};
    const eqStList: string[] = [];

    eqStList.push('想定家賃 = 指定 or 逆算');
    vDict['bd_rent_income'] = null;

    eqStList.push('満室時賃料 = 想定家賃 * 部屋数 * 12');
    vDict['bd_full_rent_yearly_'] = 'bd_rent_income * bd_room_count * 12';

    eqStList.push('年間賃料 = 満室時賃料 * (1-空室率)');
    vDict['bd_rent_yearly_'] = 'bd_full_rent_yearly_ * (1 - bd_empty_ratio)';

    eqStList.push('表面利回り(不動産価格のみ) = 年間賃料 / 物土合計');
    vDict['et_surface_ratio'] = null;

    return [vDict, eqStList];
  }

  static equationsInitCost(
    building: Building,
    bdInfo: BuildingInfo,
    land: Land,
    landInfo: LandInfo,
    estate: Estate
  ): [EquationDict, string[], Building, BuildingInfo, Land, LandInfo, Estate] {
    const vDict: EquationDict = {};
    const eqStList: string[] = [];

    const [vDict1, eqList1] = this.equationsPriceInit();
    Object.assign(vDict, vDict1);
    eqStList.push(...eqList1);

    eqStList.push('購入後経過年数 = 指定 or 1');
    vDict['et_years'] = null;

    eqStList.push('部屋数 = 指定 or 1');
    vDict['bd_room_count'] = null;

    eqStList.push('購入時築年数 = 指定 or 0');
    vDict['bd_leaves_on_purchase'] = null;

    eqStList.push('法定耐用年数 = 指定 or 47');
    vDict['bd_lifespan'] = null;

    eqStList.push('耐用年数 = 指定 or 指定パラメータによって計算');
    vDict['bd_lifespan_now'] = null;

    eqStList.push('建物登記費用 = 指定 or 80000');
    vDict['bd_reg_cost'] = null;

    eqStList.push('初期リフォーム費用 = 指定 or 0');
    vDict['bd_init_reform_cost'] = null;

    eqStList.push('残置物撤去費用 = 指定 or 0');
    vDict['bd_remove_leaves_cost'] = null;

    eqStList.push('土地登記費用 = 指定 or 80000');
    vDict['ld_reg_cost'] = null;

    eqStList.push('物件価格 = 指定');
    let value: string | null = null;
    if (building.bd_price === null && land.ld_price === null) {
      value = 'ld_price * bd_ld_bd_ratio';
    }
    vDict['bd_price'] = value;

    eqStList.push('購入仲介手数料 = 物土合計 * 0.03 + 60000');
    vDict['et_purchase_fee_'] = 'et_price_all_ * 0.03 + 60000';

    eqStList.push('建物の固定資産課税台帳登録額 = 建物の固定資産税評価額 or 指定');
    if (bdInfo.bd_tax_eval_price !== null) {
      value = null;
    } else if (bdInfo.bd_tax_account_price !== null) {
      bdInfo.bd_tax_eval_price = bdInfo.bd_tax_account_price;
      value = null;
    } else {
      value = 'bd_tax_account_price';
    }
    vDict['bd_tax_eval_price'] = value;

    eqStList.push('建物の固定資産税評価額 = 物件価格 x 0.6 * 経年減点補正率 or 指定');
    eqStList.push('経年減点補正率 = 1 * 法定耐用年数-築年数/法定耐用年数 or 0.2と大きい方');
    if (bdInfo.bd_tax_account_price === null) {
      const ratio = Math.max(
        (building.bd_lifespan - estate.et_years - building.bd_leaves_on_purchase) /
          building.bd_lifespan,
        0.2
      );
      value = `bd_price * 0.6 * ${ratio}`;
    } else {
      value = null;
    }
    vDict['bd_tax_account_price'] = value;

    eqStList.push('土地の固定資産税評価額 = 土地価格 * 0.7 / 1.1 or 指定');
    if (landInfo.ld_tax_eval_price !== null) {
      value = null;
    } else {
      value = 'ld_price * 0.7 / 1.1';
    }
    vDict['ld_tax_eval_price'] = value;

    eqStList.push('土地の固定資産課税台帳登録額 = 土地の固定資産税評価額 or 指定');
    if (landInfo.ld_tax_account_price !== null) {
      value = null;
    } else {
      value = 'ld_tax_eval_price';
    }
    vDict['ld_tax_account_price'] = value;

    eqStList.push('土地登録免許税 = 土地の固定資産税評価額 * 1.5%');
    vDict['ld_reg_tax_'] = 'ld_tax_eval_price * 0.015';

    eqStList.push('土地不動産取得税 = 土地の固定資産課税台帳登録額 * 3％');
    vDict['ld_purchase_tax_'] = 'ld_tax_account_price * 0.03';

    eqStList.push('建物登録免許税 = 建物の固定資産税評価額 * 2.0%');
    vDict['bd_reg_tax_'] = 'bd_tax_account_price * 0.02';

    eqStList.push('建物不動産取得税 = 建物の固定資産課税台帳登録額 * 0.03');
    vDict['bd_purchase_tax_'] = 'bd_tax_eval_price * 0.03';

    eqStList.push('固定資産税 = (土地の固定資産税評価額 + 建物の固定資産税評価額 ) * 1.4%');
    vDict['et_fixed_assets_tax_'] = '( ld_tax_eval_price + bd_tax_eval_price ) * 0.014';

    eqStList.push('都市計画税 = (土地の固定資産税評価額 + 建物の固定資産税評価額 ) * 0.3%');
    vDict['et_city_plan_tax_'] = '( ld_tax_eval_price + bd_tax_eval_price ) * 0.003';

    eqStList.push('初期費用総額 = 初期費用 + 初期税金');
    vDict['et_init_cost_all_'] = 'et_init_cost_ + et_init_tax_';

    eqStList.push('借入収入総額 = 初期費用総額');
    vDict['et_debt_all_'] = 'et_init_cost_all_';

    eqStList.push('頭金 = 指定 or 0');
    vDict['ln_init_amount'] = null;

    eqStList.push('借入総額 = 借入収入総額 - 頭金');
    vDict['et_debt_'] = 'et_debt_all_ - ln_init_amount';

    eqStList.push('初期キャッシュアウト = 初期費用総額 + 頭金');
    vDict['et_init_cashout_'] = 'et_init_cost_all_ + ln_init_amount';

    eqStList.push('初期キャッシュイン = 借入総額');
    vDict['et_init_cashin_'] = 'et_debt_';

    eqStList.push('初期ネット = 初期キャッシュイン- 初期キャッシュアウト');
    vDict['et_init_cashnet_'] = 'et_init_cashin_ - et_init_cashout_';

    eqStList.push(
      '初期費用 = 建物登記費用 + 物件価格 + 初期リフォーム費用 + 残置物撤去費用 + 土地登記費用  + 土地価格 + 購入仲介手数料'
    );
    vDict['et_init_cost_'] =
      'bd_reg_cost + bd_price + bd_init_reform_cost + bd_remove_leaves_cost + ld_reg_cost + ld_price + et_purchase_fee_';

    eqStList.push(
      '初期税金 = 土地登録免許税 + 建物登録免許税 + 土地不動産取得税 + 建物不動産取得税'
    );
    vDict['et_init_tax_'] =
      'ld_reg_tax_ + bd_reg_tax_ + ld_purchase_tax_ + bd_purchase_tax_';

    return [vDict, eqStList, building, bdInfo, land, landInfo, estate];
  }

  static equationsLoan(
    etDebt: number,
    loanInfo: LoanInfo,
    estate: Estate
  ): [EquationDict, string[], LoanInfo, Estate] {
    const vDict: EquationDict = {};
    const eqStList: string[] = [];

    eqStList.push('利率 = 指定 or 0.02');
    vDict['ln_ratio'] = null;

    eqStList.push('返済月数 = 指定 or 20 * 12');
    vDict['ln_monthes'] = null;

    eqStList.push('前期末ローン残高 = 指定 or 0');
    if (loanInfo.ln_debt_all_last === null) {
      loanInfo.ln_debt_all_last = etDebt;
    } else if (loanInfo.ln_debt_all_last > etDebt) {
      loanInfo.ln_debt_all_last = etDebt;
    }
    vDict['ln_debt_all_last'] = String(loanInfo.ln_debt_all_last);

    eqStList.push('残り返済月数');
    const leaveMonthes = Math.max(loanInfo.ln_monthes - (estate.et_years - 1) * 12, 0);
    vDict['leave_monthes_'] = `${leaveMonthes}`;

    eqStList.push('元本返済');
    eqStList.push('支払利息');
    let etLeaveDebtStart = loanInfo.ln_debt_all_last
    let yearlyPrincipalPaid = 0;
    if (loanInfo.ln_payment_type === LoanPayType.PRINCIPAL) {
      const principalRepaymentPerMonth =  etDebt / loanInfo.ln_monthes;
      const leaveMonthesInYear = Math.min(leaveMonthes, 12);
      yearlyPrincipalPaid = principalRepaymentPerMonth * leaveMonthesInYear;
      vDict['et_principal_repayment_'] = `${yearlyPrincipalPaid}`;

      let interestPaid = 0;
      let _etLeaveDebtStart = etLeaveDebtStart
      for (let i = 0; i < leaveMonthesInYear; i++) {
        const interest = _etLeaveDebtStart * loanInfo.ln_ratio / 12;
        _etLeaveDebtStart = _etLeaveDebtStart - principalRepaymentPerMonth;
        interestPaid += interest;
      }
      vDict['et_interest_paid_'] = `${interestPaid}`;
    } else {
      const [, yearlyInterestPaid, yearlyPrincipalPaidUpdated] =
        this.calculateYearlyBreakdownFromCurrent(
          etLeaveDebtStart,
          loanInfo.ln_ratio,
          leaveMonthes
        );
      yearlyPrincipalPaid = yearlyPrincipalPaidUpdated;
      vDict['et_principal_repayment_'] = `${yearlyPrincipalPaid}`;
      vDict['et_interest_paid_'] = `${yearlyInterestPaid}`;
    }

    eqStList.push('返済額');
    vDict['et_repayment_'] = 'et_principal_repayment_ + et_interest_paid_';

    eqStList.push('期末ローン残高');
    
    let  et_leave_debt_end_ = etLeaveDebtStart - yearlyPrincipalPaid;
    if (et_leave_debt_end_ < 100) {
      et_leave_debt_end_ = 0;
    }
    vDict['et_leave_debt_end_'] = `${et_leave_debt_end_}`;

    return [vDict, eqStList, loanInfo, estate];
  }

  static calculateYearlyBreakdownFromCurrent(
    currentBalance: number,
    annualInterestRate: number,
    remainingMonths: number
  ): [number, number, number] {
    const monthlyInterestRate = annualInterestRate / 12;

    if (remainingMonths <= 0) {
      return [0, 0, 0];
    }

    let monthlyPayment: number;
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

  static equationsYearly(
    bdInfo: BuildingInfo,
    building: Building,
    estate: Estate,
    et_taxable_income_: number | null = null,
  ): [EquationDict, string[], BuildingInfo, Building, Estate] {
    const vDict: EquationDict = {};
    const eqStList: string[] = [];

    const [vDict1, eqList1] = this.equationsPriceYearly();
    Object.assign(vDict, vDict1);
    eqStList.push(...eqList1);

    eqStList.push('年間平均賃貸AD比率 = 指定 or 0');
    vDict['bd_ad_fee_ratio'] = null;

    eqStList.push('賃貸AD = 満室時賃料 * 年間平均賃貸AD比率');
    vDict['bd_ad_fee_'] = 'bd_full_rent_yearly_ * bd_ad_fee_ratio';

    eqStList.push('管理費 = 満室時賃料 * 0.04 or 指定');
    let value: string | null;
    if (bdInfo.bd_maintenance_fee !== null) {
      value = null;
    } else {
      value = 'bd_full_rent_yearly_ * 0.04';
    }
    vDict['bd_maintenance_fee'] = value;

    eqStList.push('修繕費 = 指定 or 0');
    vDict['bd_repair_cost'] = null;

    eqStList.push('年間費用 = 支払利息 + 賃貸AD + 管理費 + 修繕費');
    vDict['et_cost_yearly_'] =
      'et_interest_paid_ + bd_ad_fee_ + bd_maintenance_fee + bd_repair_cost';

    eqStList.push('年間ネット = 年間賃料 - 年間費用');
    vDict['et_net_yearly_'] = 'bd_rent_yearly_ - et_cost_yearly_';

    eqStList.push('減価償却費 = 物件価格 / 耐用年数');
    const lifespanNow = building.bd_lifespan_now || getBuildingLifespan(building.bd_type);
    if (estate.et_years - 1 > lifespanNow) {
      value = '0';
    } else {
      value = String(building.bd_price / lifespanNow);
    }
    vDict['bd_depreciation_'] = value;

    eqStList.push('課税所得 = 年間賃料 - 年間費用 - 固定資産税 - 都市計画税 - 減価償却費');
    if (et_taxable_income_ !== null) {
      value = et_taxable_income_ > 0 ? String(et_taxable_income_) : '0';
    } else {
      value = 'bd_rent_yearly_ - et_cost_yearly_ - et_fixed_assets_tax_ - et_city_plan_tax_ - bd_depreciation_';
    }
    vDict['et_taxable_income_'] = value;

    eqStList.push('税金 = 課税所得 x 30%');
    vDict['et_tax_'] = 'et_taxable_income_ * 0.3';

    eqStList.push('年間税金キャッシュアウト = 固定資産税 + 都市計画税 + 税金');
    vDict['et_tax_all_'] = 'et_fixed_assets_tax_ + et_city_plan_tax_ + et_tax_';

    eqStList.push('最終年間ネット = 年間ネット - 年間税金キャッシュアウト - 元本返済');
    vDict['et_net_amount_'] =
      'et_net_yearly_ - et_tax_all_ - et_principal_repayment_';

    eqStList.push('前期末累計収支 = 指定');
    vDict['et_last_net_amount'] = null;

    eqStList.push('期末累計収支 = 前期末累計収支 - 最終年間ネット');
    vDict['et_net_amount_all_'] =
      'et_last_net_amount + et_net_amount_';

    eqStList.push('表面利回り(総額) = 指定 or 年間賃料 / 初期キャッシュアウト');
    vDict['et_surface_ratio_all_'] = 'bd_rent_yearly_ / et_init_cashout_';

    eqStList.push('実質利回り(不動産価格のみ) = 最終年間ネット / 物土合計');
    vDict['et_net_ratio_'] = 'et_net_amount_ / et_price_all_';

    eqStList.push('実質利回り(総額) = 指定 or 最終年間ネット / 初期キャッシュアウト');
    vDict['et_net_ratio_all_'] = 'et_net_amount_ / et_init_cashout_';

    return [vDict, eqStList, bdInfo, building, estate];
  }

  static equationsOther(
    building: Building,
    estate: Estate
  ): [EquationDict, string[], Building, Estate] {
    const vDict: EquationDict = {};
    const eqStList: string[] = [];

    eqStList.push('減価償却残年数 = 耐用年数 - 購入後経過年数');
    const lifespanNow = building.bd_lifespan_now || getBuildingLifespan(building.bd_type);
    let value: string;
    if (estate.et_years - 1 > lifespanNow) {
      value = '0';
    } else {
      value = `${lifespanNow - estate.et_years}`;
    }
    vDict['bd_depreciation_leaves_'] = value;

    eqStList.push('売却時空室率');
    vDict['bd_empty_ratio_on_sell'] = null;

    eqStList.push('売却時表面利回り(不動産価格のみ) = 指定 or 表面利回り(不動産価格のみ)');
    value = null;
    if (estate.et_surface_ratio_on_sell === null) {
      value = "et_surface_ratio"
    }
    vDict['et_surface_ratio_on_sell'] = value;

    return [vDict, eqStList, building, estate];
  }
}
