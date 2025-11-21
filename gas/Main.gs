// メイン処理ファイル - スプレッドシート対応版

/**
 * CDNからmath.jsを読み込む
 */
function loadMathJS() {
  // math.jsが既に読み込まれているかチェック
  if (typeof math !== 'undefined') {
    return;
  }
  
  try {
    // math.jsをCDNから読み込んでグローバルスコープで実行
    var response = UrlFetchApp.fetch(
      'https://cdn.jsdelivr.net/npm/mathjs@12.4.1/lib/browser/math.min.js'
    ).getContentText();
    
    // Functionコンストラクタを使用してグローバルスコープで実行
    new Function(response)();
    
    if (typeof math === 'undefined') {
      throw new Error('math.jsの読み込みに失敗しました');
    }
  } catch (e) {
    throw new Error('math.jsの読み込みエラー: ' + e.toString());
  }
}

/**
 * スプレッドシートを開いたときに実行されるメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('不動産分析')
    .addItem('分析を実行', 'analyzeCurrentSpreadsheet')
    .addToUi();
}

/**
 * 現在開いているスプレッドシートを分析
 */
function analyzeCurrentSpreadsheet() {
  try {
    // math.jsを読み込み
    loadMathJS();
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const inputSheet = spreadsheet.getSheetByName('入力');
    const outputSheet = spreadsheet.getSheetByName('結果');
    
    if (!inputSheet || !outputSheet) {
      SpreadsheetApp.getUi().alert('エラー', '「入力」または「結果」シートが見つかりません', SpreadsheetApp.getUi().ButtonSet.OK);
      return { error: '「入力」または「結果」シートが見つかりません' };
    }
    
    // ヘッダーデータを取得
    const headerDataResult = getHeaderData(inputSheet);
    const headerColumnIndex = headerDataResult[0];
    const headerRowIndex = headerDataResult[1];
    const headerData = headerDataResult[2];
    const initialData = headerDataResult[3];
    const yearData = headerDataResult[4];
    const errorMessage = headerDataResult[5];
    
    if (errorMessage) {
      SpreadsheetApp.getUi().alert('エラー', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
      return { error: errorMessage };
    }
    
    const outputHeaderResult = getOutputHeaderData(outputSheet);
    const outputError = outputHeaderResult[0];
    const outputDataStartColumnIndex = outputHeaderResult[1];
    const outputHeaderData = outputHeaderResult[2];
    
    if (outputError) {
      SpreadsheetApp.getUi().alert('エラー', outputError, SpreadsheetApp.getUi().ButtonSet.OK);
      return { error: outputError };
    }
    
    // データを準備
    const data = {
      error_msg: null,
      initial_data: initialData,
      yearly_data: yearData,
      output_data: {}
    };
    
    // 分析を実行
    const result = analyze(data);
    
    if (result.error_msg) {
      SpreadsheetApp.getUi().alert('エラー', result.error_msg, SpreadsheetApp.getUi().ButtonSet.OK);
      return { error: result.error_msg };
    }
    
    // 結果を入力シートに書き込み
    for (let i = 0; i < result.initial_data.length; i++) {
      const cell = result.initial_data[i];
      if (initialKeys.indexOf(cell.key) === -1) {
        continue;
      }
      inputSheet.getRange(cell.row_index + 1, cell.column_index + 1).setValue(cell.value);
    }
    
    // 年次データを入力シートに書き込み
    for (const key in result.yearly_data) {
      const value = result.yearly_data[key];
      for (let i = 0; i < value.length; i++) {
        const cell = value[i];
        if (yearlyInputKeys.indexOf(cell.key) === -1) {
          continue;
        }
        inputSheet.getRange(cell.row_index + 1, cell.column_index + 1).setValue(cell.value);
      }
    }
    
    // 出力データを結果シートに書き込み
    for (const year in result.output_data) {
      const kvDict = result.output_data[year];
      const columnIndex = outputDataStartColumnIndex + Number(year) - 1;
      
      for (const key in kvDict) {
        const value = kvDict[key];
        const vList = outputHeaderData[key];
        
        if (value == null || vList == null || typeof vList !== 'object' || vList.length === 0) {
          continue;
        }
        
        let v = String(value);
        if (!isNaN(Number(value))) {
          if (ratioKeys.indexOf(key) !== -1) {
            v = String((Number(value) * 100).toFixed(2)) + "%";
          } else {
            v = String(Number(Number(value).toFixed(0)).toLocaleString("ja-JP"));
          }
        }
        
        for (let j = 0; j < outputHeaderData[key].length; j++) {
          const rowIndex = outputHeaderData[key][j];
          outputSheet.getRange(rowIndex + 1, columnIndex + 1).setValue(v);
        }
      }
    }
    
    SpreadsheetApp.getUi().alert('完了', '分析が完了しました', SpreadsheetApp.getUi().ButtonSet.OK);
    return { success: true, message: '分析が完了しました' };
    
  } catch (error) {
    Logger.log('Error in analyzeCurrentSpreadsheet: ' + error.toString());
    SpreadsheetApp.getUi().alert('エラー', 'データの分析中にエラーが発生しました: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    return { error: 'データの分析中にエラーが発生しました: ' + error.toString() };
  }
}

function getHeaderData(sheet) {
  const headerColumnIndex = 0;
  let headerRowIndex = null;
  const headerData = {};
  
  // HEADERを探す
  for (let row = 0; row < 1000; row++) {
    const cellValue = sheet.getRange(row + 1, headerColumnIndex + 1).getValue();
    if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
      const cellValueString = cellValue.toString().trim();
      if (cellValueString.toUpperCase() === 'END') {
        break;
      }
      if (cellValueString.toUpperCase() === 'HEADER') {
        headerRowIndex = row;
        continue;
      }
      if (headerRowIndex === null) {
        continue;
      }
      if (cellValueString !== '') {
        headerData[cellValueString] = row;
      }
    }
  }

  if (headerRowIndex === null || !("et_years" in headerData)) {
    return [headerColumnIndex, headerRowIndex, headerData, [], {}, 'HEADER,et_yearsが見つかりませんでした'];
  }
  
  // HEADER_JPを探す
  let headerJPColumnIndex = null;
  for (let column = 0; column < 1000; column++) {
    const cellValue = sheet.getRange(headerRowIndex + 1, column + 1).getValue();
    if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
      const cellValueString = cellValue.toString().trim();
      if (cellValueString.toUpperCase() === 'END') {
        break;
      }
      if (cellValueString.toUpperCase() === 'HEADER_JP') {
        headerJPColumnIndex = column;
        break;
      }
    }
  }
  
  if (headerJPColumnIndex === null) {
    return [headerColumnIndex, headerRowIndex, headerData, [], {}, 'HEADERJPが見つかりませんでした'];
  }
  
  const dataStartColumnIndex = headerJPColumnIndex + 1;
  
  // 初期データを取得
  const initialData = [];
  for (const key of initialKeys) {
    const rowIndex = headerData[key];
    if (rowIndex === undefined) {
      continue;
    }
    const cellValue = sheet.getRange(rowIndex + 1, dataStartColumnIndex + 1).getValue();
    initialData.push({
      key: key,
      value: cellValue !== null && cellValue !== undefined && cellValue !== '' ? cellValue.toString().trim() : null,
      row_index: rowIndex,
      column_index: dataStartColumnIndex,
      et_years: 1,
    });
  }
  
  // 年次データを取得
  const yearData = {};
  for (let dataColumnIndex = dataStartColumnIndex; dataColumnIndex < dataStartColumnIndex + 100; dataColumnIndex++) {
    const etYearsCellValue = sheet.getRange(headerData["et_years"] + 1, dataColumnIndex + 1).getValue();
    if (etYearsCellValue !== null && etYearsCellValue !== undefined && etYearsCellValue.toString().trim() !== '') {
      const cellValueString = etYearsCellValue.toString().trim();
      const _yearData = [];
      for (const key in headerData) {
        const value = headerData[key];
        if (initialKeys.includes(key)) {
          continue;
        }
        let cellValue = sheet.getRange(value + 1, dataColumnIndex + 1).getValue();
        if (key === "et_years") {
          cellValue = etYearsCellValue;
        }
        _yearData.push({
          key: key,
          value: cellValue !== null && cellValue !== undefined && cellValue !== '' ? cellValue.toString().trim() : null,
          row_index: value,
          column_index: dataColumnIndex,
          et_years: cellValueString,
        });
      }
      yearData[cellValueString] = _yearData;
    } else {
      break;
    }
  }
  
  if (Object.keys(yearData).length === 0) {
    const _yearData = [];
    for (const key in headerData) {
      const value = headerData[key];
      if (initialKeys.includes(key)) {
        continue;
      }
      let cellValue = sheet.getRange(value + 1, dataStartColumnIndex + 1).getValue();
      if (key === "et_years") {
        cellValue = "1";
      }
      _yearData.push({
        key: key,
        value: cellValue !== null && cellValue !== undefined && cellValue !== '' ? cellValue.toString().trim() : null,
        row_index: value,
        column_index: dataStartColumnIndex,
        et_years: 1,
      });
    }
    yearData["1"] = _yearData;
  }
  
  return [headerColumnIndex, headerRowIndex, headerData, initialData, yearData, null];
}

function getOutputHeaderData(sheet) {
  const headerColumnIndex = 0;
  let headerRowIndex = null;
  const headerData = {};
  
  for (let row = 0; row < 1000; row++) {
    const cellValue = sheet.getRange(row + 1, headerColumnIndex + 1).getValue();
    if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
      const cellValueString = cellValue.toString().trim();
      if (cellValueString.toUpperCase() === 'END') {
        break;
      }
      if (cellValueString.toUpperCase() === 'HEADER') {
        headerRowIndex = row;
        continue;
      }
      if (headerRowIndex === null) {
        continue;
      }
      if (cellValueString !== '') {
        if (cellValueString in headerData) {
          headerData[cellValueString].push(row);
        } else {
          headerData[cellValueString] = [row];
        }
      }
    }
  }
  
  if (headerRowIndex === null) {
    return ['HEADERが見つかりませんでした', null, headerData];
  }
  
  let headerJPColumnIndex = null;
  for (let column = 0; column < 1000; column++) {
    const cellValue = sheet.getRange(headerRowIndex + 1, column + 1).getValue();
    if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
      const cellValueString = cellValue.toString().trim();
      if (cellValueString.toUpperCase() === 'END') {
        break;
      }
      if (cellValueString.toUpperCase() === 'HEADER_JP') {
        headerJPColumnIndex = column;
        break;
      }
    }
  }
  
  if (headerJPColumnIndex === null) {
    return ['HEADERJPが見つかりませんでした', null, headerData];
  }
  
  const dataStartColumnIndex = headerJPColumnIndex + 1;
  return [null, dataStartColumnIndex, headerData];
}
