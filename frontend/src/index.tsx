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

// モジュールの登録
IgrExcelCoreModule.register();
IgrExcelModule.register();
IgrExcelXlsxModule.register();
IgrSpreadsheetModule.register();

const SpreadsheetOverview = () => {
  const spreadsheetRef = useRef<IgrSpreadsheet | null>(null);
  const [apiData, setApiData] = useState<{ message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const analyzeSheet = async () => {
    try {
      // スプレッドシートからA列の値を取得
      if (!spreadsheetRef.current?.workbook) {
        setError('スプレッドシートが読み込まれていません');
        return;
      }
      const worksheet = spreadsheetRef.current.workbook.worksheets(0);

      // A列の設定確認
      let headerRow = null;
      for (let row = 1; row < 1000; row++) { 
        const cellValue = worksheet.getCell("A" + row).value;
        if (cellValue !== null && cellValue !== undefined) {
          if (cellValue.toString().trim().toUpperCase() === 'HEADER') {
            headerRow = row;
            break;
          }
        }
      }
      
      if (!headerRow) {
        setError('A列の設定を確認してください。HEADERが見つかりませんでした');
        return;
      }

      let endRow = null;
      for (let row = headerRow + 1; row < 1000; row++) { 
        const cellValue = worksheet.getCell("A" + row).value;
        if (cellValue !== null && cellValue !== undefined) {
          if (cellValue.toString().trim().toUpperCase() === 'END') {
            endRow = row;
            break;
          }
        }
      }
      if (!endRow) {
        setError('A列の設定を確認してください。ENDが見つかりませんでした');
        return;
      }

      let data: { [key: number]: string } = {};
      for (let row = headerRow + 1; row < endRow; row++) { 
        const cellValue = worksheet.getCell("A" + row).value;
        if (cellValue !== null && cellValue !== undefined) {
          const cellValueString = cellValue.toString().trim();
          if (cellValueString !== '') {
            data[row] = cellValueString;
          }
        }
      }
      console.log(data)
      return
      // APIリクエスト
      const response = await axios.get('http://localhost:8111/', {
        withCredentials: true,
      });
      console.log('APIレスポンス:', response.data);
      setApiData(response.data);
      setError(null);
    } catch (err) {
      setError('処理中にエラーが発生しました');
      console.error('Error:', err);
    }
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
          <button onClick={analyzeSheet}>分析</button>
          {error && <div className="error-message">{error}</div>}
          {apiData && <div className="api-data">APIレスポンス: {apiData.message}</div>}
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
