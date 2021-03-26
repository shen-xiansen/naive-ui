import { CSSProperties, ComputedRef, computed } from 'vue'
import { DataTableProps } from './DataTable'
import type {
  ExpandColInfo,
  SelectionColInfo,
  TableColumn,
  TableColumnInfo,
  TableColumns
} from './interface'
import { getColKey, createCustomWidthStyle } from './utils'

export interface RowItem {
  colSpan: number
  rowSpan: number
  column: TableColumn
  isLast: boolean
}
export interface ColItem {
  key: string | number
  style: CSSProperties
  column: SelectionColInfo | ExpandColInfo | TableColumnInfo
}

type RowItemMap = WeakMap<TableColumn, RowItem>
function getRowsAndCols (
  columns: TableColumns
): {
    rows: RowItem[][]
    cols: ColItem[]
    dataRelatedCols: Array<SelectionColInfo | TableColumnInfo | ExpandColInfo>
  } {
  const rows: RowItem[][] = []
  const cols: ColItem[] = []
  const dataRelatedCols: Array<
  SelectionColInfo | TableColumnInfo | ExpandColInfo
  > = []
  const rowItemMap: RowItemMap = new WeakMap()
  let maxDepth = -1
  let totalRowSpan = 0
  function ensureMaxDepth (columns: TableColumns, currentDepth: number): void {
    if (currentDepth > maxDepth) {
      rows[currentDepth] = []
      maxDepth = currentDepth
    }
    for (const column of columns) {
      if ('children' in column) {
        ensureMaxDepth(column.children, currentDepth + 1)
      } else {
        cols.push({
          key: getColKey(column),
          style: createCustomWidthStyle(column),
          column
        })
        totalRowSpan += 1
        dataRelatedCols.push(column)
      }
    }
  }
  ensureMaxDepth(columns, 0)
  function ensureColLayout (
    columns: TableColumns,
    currentDepth: number,
    parentIsLast: boolean
  ): void {
    let currentLeafIndex = -1
    let hideUntilIndex = 0
    const lastIndex = columns.length - 1
    columns.forEach((column, index) => {
      if ('children' in column) {
        // do not allow colSpan > 1 for non-leaf th
        const isLast = parentIsLast && index === lastIndex
        const rowItem: RowItem = {
          column,
          colSpan: 0,
          rowSpan: 1,
          isLast
        }
        ensureColLayout(column.children, currentDepth + 1, isLast)
        column.children.forEach((childColumn) => {
          rowItem.colSpan += rowItemMap.get(childColumn)?.colSpan ?? 0
        })
        rowItemMap.set(column, rowItem)
        rows[currentDepth].push(rowItem)
      } else {
        currentLeafIndex += 1
        if (currentLeafIndex < hideUntilIndex) {
          return
        }
        let colSpan: number = 1
        if ('titleColSpan' in column) {
          colSpan = column.titleColSpan ?? 1
        }
        if (colSpan > 1) {
          hideUntilIndex = currentLeafIndex + colSpan
        }
        const isLast = currentLeafIndex + colSpan === totalRowSpan
        const rowItem: RowItem = {
          column,
          colSpan: colSpan,
          rowSpan: maxDepth - currentDepth + 1,
          isLast
        }
        rowItemMap.set(column, rowItem)
        rows[currentDepth].push(rowItem)
      }
    })
  }
  ensureColLayout(columns, 0, true)

  return {
    rows,
    cols,
    dataRelatedCols
  }
}

export function useGroupHeader (
  props: DataTableProps
): {
    rows: ComputedRef<RowItem[][]>
    cols: ComputedRef<ColItem[]>
    dataRelatedCols: ComputedRef<
    Array<SelectionColInfo | TableColumnInfo | ExpandColInfo>
    >
  } {
  const rowsAndCols = computed(() => getRowsAndCols(props.columns))
  return {
    rows: computed(() => rowsAndCols.value.rows),
    cols: computed(() => rowsAndCols.value.cols),
    dataRelatedCols: computed(() => rowsAndCols.value.dataRelatedCols)
  }
}