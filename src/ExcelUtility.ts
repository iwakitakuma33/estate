import { saveAs } from 'file-saver';
import {
  Workbook,
  WorkbookFormat,
  WorkbookSaveOptions,
  WorkbookLoadOptions,
} from 'igniteui-react-excel';
import { IgrExcelXlsxModule } from 'igniteui-react-excel';
import { IgrExcelCoreModule } from 'igniteui-react-excel';
import { IgrExcelModule } from 'igniteui-react-excel';

// モジュールの登録
IgrExcelCoreModule.register();
IgrExcelModule.register();
IgrExcelXlsxModule.register();

export class ExcelUtility {
  private static getExtension(format: WorkbookFormat): string {
    const extensionMap: Record<WorkbookFormat, string> = {
      [WorkbookFormat.StrictOpenXml]: '.xlsx',
      [WorkbookFormat.Excel2007]: '.xlsx',
      [WorkbookFormat.Excel2007MacroEnabled]: '.xlsm',
      [WorkbookFormat.Excel2007MacroEnabledTemplate]: '.xltm',
      [WorkbookFormat.Excel2007Template]: '.xltx',
      [WorkbookFormat.Excel97To2003]: '.xls',
      [WorkbookFormat.Excel97To2003Template]: '.xlt',
    };

    return extensionMap[format] ?? '.xlsx';
  }

  static async load(file: File): Promise<Workbook> {
    try {
      const data = await this.readFileAsUint8Array(file);
      return await this.loadWorkbook(data);
    } catch (error) {
      throw new Error(`Failed to load workbook: ${error}`);
    }
  }

  static async save(workbook: Workbook, fileNameWithoutExtension: string): Promise<string> {
    try {
      const options = new WorkbookSaveOptions();
      options.type = 'blob';

      const blob = await new Promise<Blob>((resolve, reject) => {
        workbook.save(options, 
          (data) => resolve(data as Blob),
          (error) => reject(error)
        );
      });

      const fileExt = this.getExtension(workbook.currentFormat);
      const fileName = fileNameWithoutExtension + fileExt;
      saveAs(blob, fileName);
      return fileName;
    } catch (error) {
      throw new Error(`Failed to save workbook: ${error}`);
    }
  }

  private static async readFileAsUint8Array(file: File): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);

     
    reader.onload = (e): void => {
        resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.readAsArrayBuffer(file);
    });
  }

  private static loadWorkbook(data: Uint8Array): Promise<Workbook> {
    return new Promise<Workbook>((resolve, reject) => {
      Workbook.load(
        data,
        new WorkbookLoadOptions(),
        (workbook) => resolve(workbook),
        (error) => reject(error)
      );
    });
  }
}
