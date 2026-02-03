import { useTable } from 'react-table';

const UploadHistory = () => {
  const columns = [
    {
      Header: 'File Name',
      accessor: 'fileName',
    },
    {
      Header: 'Upload Date',
      accessor: 'uploadDate',
    },
  ];

  const data = [
    {
      fileName: 'file1.txt',
      uploadDate: '2022-01-01',
    },
    {
      fileName: 'file2.txt',
      uploadDate: '2022-01-02',
    },
  ];

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({
    columns,
    data,
  });

  return (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map((headerGroup) => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column) => (
              <th {...column.getHeaderProps()}>
                {column.render('Header')}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map((cell) => (
                <td {...cell.getCellProps()}>
                  {cell.render('Cell')}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};