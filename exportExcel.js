function exportToExcel(data, filename) {
    if (!data || data.length === 0) {
        alert('No data to export');
        return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, `${filename}.xlsx`);
}
