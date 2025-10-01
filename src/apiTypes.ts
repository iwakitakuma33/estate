export interface KeyValueDict {
  [key: string]: number | string | null;
}
export interface CellByRow {
    key: string;
    value: string | null;
    row_index: number;
    column_index: number;
    et_years: number | null;
    title?: string | null;
  }  
 

  export interface ColumnDataForEstate {
    error_msg: string | null;
    initial_data: CellByRow[];
    yearly_data: Map<string,CellByRow[]>;
    output_data: Map<string,KeyValueDict>;
  }
