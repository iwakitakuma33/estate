// 分析ロジック部分

/**
 * 分析メイン関数
 */
function analyze(data) {
  const yearly_data_1 = data.yearly_data["1"] || [];
  const all_yearly_data = JSON.parse(JSON.stringify(data.yearly_data));
  const cells = data.initial_data.concat(yearly_data_1);
  
  const parseResult = parseData(data, cells);
  const dataResult = parseResult[0];
  let keyVDict = parseResult[1];
  const building = parseResult[4];
  const bdInfo = parseResult[5];
  const land = parseResult[6];
  const landInfo = parseResult[7];
  const loan = parseResult[8];
  const loanInfo = parseResult[9];
  const estate = parseResult[10];
  
  if (dataResult.error_msg !== null) {
    return dataResult;
  }
  
  data.initial_data = updateData(data.initial_data, keyVDict);
  data.yearly_data = {};
  let yearly_data = updateData(yearly_data_1, keyVDict);
  const year_data_1st = JSON.parse(JSON.stringify(yearly_data));
  data.yearly_data["1"] = yearly_data;
  data.output_data["1"] = JSON.parse(JSON.stringify(keyVDict));
  
  const allYears = (loanInfo.ln_monthes / 12) + 3;
  let yearColumnIndex = null;
  for (let i = 0; i < year_data_1st.length; i++) {
    yearColumnIndex = year_data_1st[i].column_index;
    break;
  }
  
  for (let year = 2; year <= allYears; year++) {
    const _yearData = JSON.parse(JSON.stringify(all_yearly_data[String(year)] || yearly_data));
    for (let i = 0; i < _yearData.length; i++) {
      const cell = _yearData[i];
      cell.et_years = year;
      cell.column_index = yearColumnIndex + year - 1;
      if (cell.value == null) {
        continue;
      }
      if (cell.key === "et_years") {
        cell.value = String(year);
      } else if (cell.key === "ln_debt_all_last") {
        cell.value = String(keyVDict['et_leave_debt_end_']);
      } else if (cell.key === "et_last_net_amount") {
        cell.value = String(keyVDict['et_net_amount_all_']);
      }
    }
    
    const yearly_cells = data.initial_data.concat(_yearData);
    const parseResultUpdated = parseData(data, yearly_cells);
    const dataResultUpdated = parseResultUpdated[0];
    const keyVDictUpdated = parseResultUpdated[1];
    
    keyVDict["et_years"] = year;
    for (const key in keyVDictUpdated) {
      keyVDict[key] = keyVDictUpdated[key];
    }
    
    data.initial_data = updateData(data.initial_data, keyVDict);
    yearly_data = updateData(_yearData, keyVDict);
    data.yearly_data[String(year)] = yearly_data;
    data.output_data[String(year)] = JSON.parse(JSON.stringify(keyVDict));
  }
  
  return data;
}

/**
 * データをパースして分析
 */
function parseData(data, cells) {
  // 手動バリデーションを使用（zodなし）
  
  // Building
  const buildingResult = parseFromCellData(cells, buldingFieldNames, {});
  let building = createBuilding(buildingResult.data);
  let remainingCells = buildingResult.remainingCells;
  
  // BuildingInfo
  const bdInfoResult = parseFromCellData(remainingCells, buildingInfoFieldNames, {});
  let bdInfo = createBuildingInfo(bdInfoResult.data);
  remainingCells = bdInfoResult.remainingCells;
  
  // Land
  const landResult = parseFromCellData(remainingCells, landFieldNames, {});
  let land = createLand(landResult.data);
  remainingCells = landResult.remainingCells;
  
  // LandInfo
  const landInfoResult = parseFromCellData(remainingCells, landInfoFieldNames, {});
  let landInfo = createLandInfo(landInfoResult.data);
  remainingCells = landInfoResult.remainingCells;
  
  // Loan
  const loanResult = parseFromCellData(remainingCells, loanFieldNames, {});
  let loan = createLoan(loanResult.data);
  remainingCells = loanResult.remainingCells;
  
  // LoanInfo
  const loanInfoResult = parseFromCellData(remainingCells, loanInfoFieldNames, {});
  let loanInfo = createLoanInfo(loanInfoResult.data);
  remainingCells = loanInfoResult.remainingCells;
  
  // Estate
  const estateResult = parseFromCellData(remainingCells, estateFieldNames, {});
  let estate = createEstate(estateResult.data);
  
  const messageList = [].concat(
    buildingResult.errors,
    bdInfoResult.errors,
    landResult.errors,
    landInfoResult.errors,
    loanResult.errors,
    loanInfoResult.errors,
    estateResult.errors
  );
  
  if (messageList.length > 0) {
    data.error_msg = messageList.join(', ');
    return [data, null, null, null, building, bdInfo, land, landInfo, loan, loanInfo, estate];
  }
  
  // バリデーション
  const validationFields = [
    bdInfo.bd_empty_ratio,
    bdInfo.bd_rent_income,
    estate.et_surface_ratio
  ];
  const nonNoneCount = validationFields.filter(function(field) { return field !== null; }).length;
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
    return [data, null, null, null, building, bdInfo, land, landInfo, loan, loanInfo, estate];
  }
  
  if (bdInfo.bd_empty_ratio === null) {
    bdInfo.bd_empty_ratio = 1 - (estate.et_surface_ratio * (building.bd_price + land.ld_price) / (bdInfo.bd_rent_income * building.bd_room_count * 12));
  } else if (bdInfo.bd_rent_income === null) {
    bdInfo.bd_rent_income = estate.et_surface_ratio * (building.bd_price + land.ld_price) / (building.bd_room_count * 12 * (1 - bdInfo.bd_empty_ratio));
  } else if (estate.et_surface_ratio === null) {
    estate.et_surface_ratio = bdInfo.bd_rent_income * building.bd_room_count * 12 * (1 - bdInfo.bd_empty_ratio) / (building.bd_price + land.ld_price);
  }
  
  // 価格方程式を解く
  const eqDictPrice = equationsPrice();
  let keyVDict = modelDumps(building, bdInfo, loan, land, landInfo, estate, loanInfo, {});
  keyVDict = solve(eqDictPrice, keyVDict);
  building.bd_price = Number(keyVDict['bd_price']);
  land.ld_price = Number(keyVDict['ld_price']);
  keyVDict = modelDumps(building, bdInfo, loan, land, landInfo, estate, loanInfo, {});
  keyVDict = solve(eqDictPrice, keyVDict);
  
  // 初期費用計算
  const initCostResult = equationsInitCost(building, bdInfo, land, landInfo, estate);
  const eqDictInit = initCostResult[0];
  building = initCostResult[2];
  bdInfo = initCostResult[3];
  land = initCostResult[4];
  landInfo = initCostResult[5];
  estate = initCostResult[6];
  
  keyVDict = modelDumps(building, bdInfo, loan, land, landInfo, estate, loanInfo, keyVDict);
  keyVDict = solve(eqDictInit, keyVDict);
  const etDebt = Number(keyVDict['et_debt_']);
  
  // 方程式を構築
  const eqDict = {};
  const initCostResult2 = equationsInitCost(building, bdInfo, land, landInfo, estate);
  const eqDictInit2 = initCostResult2[0];
  building = initCostResult2[2];
  bdInfo = initCostResult2[3];
  land = initCostResult2[4];
  landInfo = initCostResult2[5];
  estate = initCostResult2[6];
  
  for (const key in eqDictInit2) {
    eqDict[key] = eqDictInit2[key];
  }
  
  keyVDict = modelDumps(building, bdInfo, loan, land, landInfo, estate, loanInfo, keyVDict);
  
  // ローン計算
  const loanResult2 = equationsLoan(etDebt, loanInfo, estate);
  const eqDictLoan = loanResult2[0];
  loanInfo = loanResult2[2];
  estate = loanResult2[3];
  
  for (const key in eqDictLoan) {
    eqDict[key] = eqDictLoan[key];
  }
  
  // 年次計算
  let yearlyResult = equationsYearly(bdInfo, building, estate, null);
  const eqDictYearly = yearlyResult[0];
  bdInfo = yearlyResult[2];
  building = yearlyResult[3];
  estate = yearlyResult[4];
  
  for (const key in eqDictYearly) {
    eqDict[key] = eqDictYearly[key];
  }
  
  // その他の計算
  let otherResult = equationsOther(building, estate);
  const eqDictOther = otherResult[0];
  building = otherResult[2];
  estate = otherResult[3];
  
  for (const key in eqDictOther) {
    eqDict[key] = eqDictOther[key];
  }
  
  let _keyVDict = solve(eqDict, keyVDict);
  
  // 課税所得を使って再計算
  yearlyResult = equationsYearly(bdInfo, building, estate, Number(_keyVDict['et_taxable_income_']));
  const eqDictYearly2 = yearlyResult[0];
  bdInfo = yearlyResult[2];
  building = yearlyResult[3];
  estate = yearlyResult[4];
  
  for (const key in eqDictYearly2) {
    eqDict[key] = eqDictYearly2[key];
  }
  
  otherResult = equationsOther(building, estate);
  const eqDictOther2 = otherResult[0];
  building = otherResult[2];
  estate = otherResult[3];
  
  for (const key in eqDictOther2) {
    eqDict[key] = eqDictOther2[key];
  }
  
  keyVDict = solve(eqDict, keyVDict);
  
  return [data, keyVDict, eqDict, [], building, bdInfo, land, landInfo, loan, loanInfo, estate];
}

/**
 * データを更新
 */
function updateData(cells, keyVDict) {
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.key != null && keyVDict.hasOwnProperty(cell.key) && keyVDict[cell.key] !== undefined) {
      cell.value = String(keyVDict[cell.key]);
    }
  }
  return cells;
}

/**
 * モデルをダンプ
 */
function modelDumps(building, bdInfo, loan, land, landInfo, estate, loanInfo, kvDict) {
  const keyVDict = JSON.parse(JSON.stringify(kvDict || {}));
  for (const key in building) keyVDict[key] = building[key];
  for (const key in bdInfo) keyVDict[key] = bdInfo[key];
  for (const key in loan) keyVDict[key] = loan[key];
  for (const key in land) keyVDict[key] = land[key];
  for (const key in landInfo) keyVDict[key] = landInfo[key];
  for (const key in estate) keyVDict[key] = estate[key];
  for (const key in loanInfo) keyVDict[key] = loanInfo[key];
  return keyVDict;
}

/**
 * 方程式を解く（math.js使用）
 */
function solve(eqDict, keyVDict) {
  const filteredDictNotNull = {};
  const scope = {};
  
  for (const key in keyVDict) {
    const value = keyVDict[key];
    if (typeof value === 'number') {
      scope[key] = value;
      filteredDictNotNull[key] = value;
    } else if (value !== null) {
      filteredDictNotNull[key] = value;
    }
  }
  
  const results = JSON.parse(JSON.stringify(filteredDictNotNull));
  let maxIterations = 1000;
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    
    for (const symbolStr in eqDict) {
      const eqStr = eqDict[symbolStr];
      if (eqStr === null || (symbolStr != null && results[symbolStr] !== undefined && results[symbolStr] !== null)) {
        continue;
      }
      try {
        const result = math.evaluate(eqStr, scope);
        if (typeof result === 'number' && !isNaN(result) && result !== null) {
          results[symbolStr] = result;
          scope[symbolStr] = result;
        }
      } catch (e) {
        // エラーは無視
      }
    }
  }
  
  for (const key in keyVDict) {
    if (!(key != null && results[key] !== undefined)) {
      results[key] = keyVDict[key];
    }
  }
  
  return results;
}

// 方程式定義関数は次のファイルに続く...
