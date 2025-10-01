import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import './index.css';
import { IgrExcelXlsxModule } from 'igniteui-react-excel';
import { IgrExcelCoreModule } from 'igniteui-react-excel';
import { IgrExcelModule } from 'igniteui-react-excel';
import { IgrSpreadsheetModule } from 'igniteui-react-spreadsheet';
import { IgrSpreadsheet } from 'igniteui-react-spreadsheet';
import { ExcelUtility } from './ExcelUtility';
import { Worksheet } from 'igniteui-react-excel';
import { ColumnDataForEstate,CellByRow } from './apiTypes';
import { Analyser } from './analyzer';
// モジュールの登録
IgrExcelCoreModule.register();
IgrExcelModule.register();
IgrExcelXlsxModule.register();
IgrSpreadsheetModule.register();

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
]
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
]

const ratioKeys = [
  "et_surface_ratio",
  "et_net_ratio_",
  "et_surface_ratio_all_",
  "et_net_ratio_all_",
  "bd_empty_ratio",
  "ln_ratio",
  "bd_ad_fee_ratio",
  "et_surface_ratio",
  "et_net_ratio_",
  "et_surface_ratio_all_",
  "et_net_ratio_all_",
]
const SpreadsheetOverview = () => {
  const spreadsheetRef = useRef<IgrSpreadsheet | null>(null);
  const [error, setError] = useState<string | null>(null);

  // sample.xlsxを自動的に読み込む
  useEffect(() => {
    const loadSampleFile = async () => {
      if (!spreadsheetRef.current) return;

      try {
        // Viteのベースパスを考慮したパス
        const basePath = import.meta.env.BASE_URL || '/';
        const response = await fetch(`${basePath}sample.xlsx`);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        const file = new File([blob], 'sample.xlsx', { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const workbook = await ExcelUtility.load(file);
        spreadsheetRef.current.workbook = workbook;
      } catch (error) {
        console.error('Sample file load error:', error);
        setError(`サンプルファイルの読み込みに失敗しました: ${error.message}`);
      }
    };

    loadSampleFile();
  }, [spreadsheetRef.current]);

  const handleFileChange = async (files: FileList | null) => {
    if (!files?.length || !spreadsheetRef.current) return;
    try {
      const workbook = await ExcelUtility.load(files[0]);
      spreadsheetRef.current.workbook = workbook;
    } catch (error) {
      console.error('Workbook Load Error:', error);
    }
  };

  const saveFile = async () => {
      await ExcelUtility.save(spreadsheetRef.current.workbook,"result");
  };

  const getSheet = async (sheetName: string) => {
    const workbook = spreadsheetRef.current.workbook;
    let inputSheet = null;
    for (let i = 0; i < workbook.worksheets().count; i++) {
      const sheet = workbook.worksheets().item(i);
      if (sheet.name === sheetName) {
        inputSheet = sheet;
        break;
      }
    }
    return inputSheet;
  }

  
  const getHeaderData = async (worksheet: Worksheet): Promise<[number, number, { [key: string]: number }, CellByRow[], Map<string,CellByRow[]>, string | null]> => {
    // HEADERはA列目
    let headerColumnIndex = 0;
    // A列の設定確認
    let headerRowIndex = 0;
    // HEADERにあるkey
    let headerData: { [key: string]: number } = {};
    for (let row = 0; row < 1000; row++) { 
      const cellValue = worksheet.rows(row).cells(headerColumnIndex).value;
      if (cellValue !== null && cellValue !== undefined) {
        const cellValueString = cellValue.toString().trim();
        if (cellValueString.toUpperCase() === 'END') {
          break;
        }
        if (cellValueString.toUpperCase() === 'HEADER') {
          headerRowIndex = row;
          continue;
        }
        if (headerRowIndex == null) {
          continue;
        }
        if (cellValueString !== '') {
          headerData[cellValueString] = row;
        }
      }
    }
    if (headerRowIndex === null || !("et_years" in headerData)) {
      return [headerColumnIndex, headerRowIndex, headerData, null, new Map(), 'HEADER,et_yearsが見つかりませんでした'];
    }

    // HEADERJP列の右側以降に入力値を入れるためHEADERJPの列目を取得
    let headerJPColumnIndex = null;
    for (let column = 0; column < 1000; column++) { 
      const cellValue = worksheet.rows(headerRowIndex).cells(column).value;
      if (cellValue !== null && cellValue !== undefined) {
        const cellValueString = cellValue.toString().trim();
        if (cellValueString.toUpperCase() === 'END') {
          break;
        }
        if (cellValueString.toUpperCase() === 'HEADER_JP') {
          headerJPColumnIndex = column;
          continue;
        }
      }
    }
    if (headerRowIndex === null) {
      return [headerColumnIndex, headerRowIndex, headerData,[],new Map(), 'HEADERJPが見つかりませんでした'];
    }
    const dataStartColumnIndex = headerJPColumnIndex + 1;

    // 初期項目を取得する
    let initialData: CellByRow[] = [];
    for (const key of initialKeys) {
      const rowIndex = headerData[key];
      if (rowIndex === null) {
        continue;
      }
      const cellValue = worksheet.rows(rowIndex).cells(dataStartColumnIndex).value;
      initialData.push({
        key: key,
        value: cellValue !== null && cellValue !== undefined ? cellValue.toString().trim() : null,
        row_index: rowIndex,
        column_index: dataStartColumnIndex,
        et_years: 1,
      });
    }

    let yearData: Map<string,CellByRow[]> = new Map();
    for (let dataColumIndex = dataStartColumnIndex; dataColumIndex < 100; dataColumIndex++) { 
      const etYearsCellValue = worksheet.rows(headerData["et_years"]).cells(dataColumIndex).value;
      if (etYearsCellValue !== null && etYearsCellValue !== undefined && etYearsCellValue.toString().trim() !== '') {
        const cellValueString = etYearsCellValue.toString().trim();
        let _yearData: CellByRow[] = [];
        for (const [key, value] of Object.entries(headerData)) {
          if ( initialKeys.includes(key)) {
            continue;
          }
          let cellValue = worksheet.rows(value).cells(dataColumIndex).value;
          if (key == "et_years") {
            cellValue = etYearsCellValue;
          }
          _yearData.push({
            key: key,
            value: cellValue !== null && cellValue !== undefined ? cellValue.toString().trim() : null,
            row_index: value,
            column_index: dataColumIndex,
            et_years: cellValueString,
          });
        }
        yearData.set(cellValueString, _yearData);
      } else {
        break;
      }
    }
    if (yearData.size === 0) {
      let _yearData: CellByRow[] = [];
      for (const [key, value] of Object.entries(headerData)) {
        if ( initialKeys.includes(key)) {
          continue;
        }
        let cellValue = null;
        cellValue = worksheet.rows(value).cells(dataStartColumnIndex).value;
        if (key == "et_years") {
          cellValue = "1";
        }
        _yearData.push({
          key: key,
          value: cellValue !== null && cellValue !== undefined ? cellValue.toString().trim() : null,
          row_index: value,
          column_index: dataStartColumnIndex,
          et_years: 1,
        });
        yearData.set("1", _yearData);
      }
    }
    return [headerColumnIndex, headerRowIndex, headerData, initialData, yearData, null];
  };
  
  const getOutputHeaderData = async (worksheet: Worksheet): Promise<[string | null, number | null,  { [key: string]: number[] }]> => {
    // HEADERはA列目
    let headerColumnIndex = 0;
    // A列の設定確認
    let headerRowIndex = 0;
    // HEADERにあるkey
    let headerData: { [key: string]: number[] } = {};
    for (let row = 0; row < 1000; row++) { 
      const cellValue = worksheet.rows(row).cells(headerColumnIndex).value;
      if (cellValue !== null && cellValue !== undefined) {
        const cellValueString = cellValue.toString().trim();
        if (cellValueString.toUpperCase() === 'END') {
          break;
        }
        if (cellValueString.toUpperCase() === 'HEADER') {
          headerRowIndex = row;
          continue;
        }
        if (headerRowIndex == null) {
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
      return ['HEADERが見つかりませんでした', null , headerData];
    }

    // HEADERJP列の右側以降に入力値を入れるためHEADERJPの列目を取得
    let headerJPColumnIndex = null;
    for (let column = 0; column < 1000; column++) { 
      const cellValue = worksheet.rows(headerRowIndex).cells(column).value;
      if (cellValue !== null && cellValue !== undefined) {
        const cellValueString = cellValue.toString().trim();
        if (cellValueString.toUpperCase() === 'END') {
          break;
        }
        if (cellValueString.toUpperCase() === 'HEADER_JP') {
          headerJPColumnIndex = column;
          continue;
        }
      }
    }
    if (headerJPColumnIndex === null) {
      return ['HEADERJPが見つかりませんでした', null , headerData];
    }
    const dataStartColumnIndex = headerJPColumnIndex + 1;
    return [null, dataStartColumnIndex, headerData];
  };

  const inputAnalyze = async () => {
    const worksheet = await getSheet("入力");
    const outputWorkSheet = await getSheet("結果");
    if (!worksheet || !outputWorkSheet) {
      setError('スプレッドシートが読み込まれていません');
      return;
    }
    const [headerColumnIndex, headerRowIndex, headerData, initialData, yearData, errorMessage] = await getHeaderData(worksheet);
    const [outputError, outputDataStartColumnIndex, outputHeaderData] = await getOutputHeaderData(outputWorkSheet);
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    if (outputError) {
      setError(outputError);
      return;
    }
    const data: ColumnDataForEstate = {
      error_msg: null,
      initial_data: initialData,
      yearly_data: yearData,
      output_data: new Map(),
    };
    const result = Analyser.analyze(data);
    for (const cell of result.initial_data) {
      if (!initialKeys.includes(cell.key)) {
        continue;
      }
      worksheet.rows(cell.row_index).cells(cell.column_index).value = cell.value;
    }
    result.yearly_data.forEach((value, key, map) => {
      for (const cell of value) {
        if (!yearlyInputKeys.includes(cell.key)) {
          continue;
        }
        worksheet.rows(cell.row_index).cells(cell.column_index).value = cell.value;
      }
    });
    result.output_data.forEach((kvDict, year, _) => {
      const columnIndex = outputDataStartColumnIndex + Number(year) - 1;
      for (const [key, value] of Object.entries(kvDict)) {
        const vList = outputHeaderData[key];
        if (value == null || vList == null || typeof vList !== 'object' || vList.length === 0 || vList == undefined) {
          continue;
        }
        let v = String(value);
        if (!isNaN(Number(value))) {
          if (ratioKeys.includes(key)) {
            v = String((Number(value) * 100).toFixed(2)) + "%";
          } else {
            v = String(Number(Number(value).toFixed(0)).toLocaleString("ja-JP"));
          }
        }
        outputHeaderData[key].forEach((rowIndex) => {
          outputWorkSheet.rows(rowIndex).cells(columnIndex).value = v;
        });
      }
    });
  };


  const handleSpreadsheetRef = (spreadsheet: IgrSpreadsheet) => {
    if (!spreadsheet) return;
    
    spreadsheetRef.current = spreadsheet;
  };

  // 初期表示時は空のスプレッドシートを表示

  return (
    <div className="container sample">
      <div className="options horizontal">
        <input
          type="file"
          onChange={(e) => handleFileChange(e.target.files)}
          accept=".xls, .xlt, .xlsx, .xlsm, .xltm, .xltx"
        />
          <button onClick={saveFile}>保存</button>
          <button onClick={inputAnalyze}>結果を分析</button>
          {error && <div className="error-message">{error}</div>}
      </div>
      <IgrSpreadsheet
        ref={handleSpreadsheetRef}
        height="calc(100% - 30px)"
        width="100%"
      />
    </div>
  );
};

// Reactコンポーネントのレンダリング
const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);
root.render(<SpreadsheetOverview />);
