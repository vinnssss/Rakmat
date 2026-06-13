import ApexCharts from 'apexcharts';

const formatRupiah = (val) => {
  if (val == null) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(val);
};

const namaBulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

document.addEventListener('DOMContentLoaded', async () => {


  const userId = localStorage.getItem('userId');




  if (document.getElementById('salesPurchaseChart')) {
    let penjualanData = Array(12).fill(0);
    let pengeluaranData = Array(12).fill(0);

    try {
      const res = await fetch(`http://localhost:5000/api/dashboard/grafik-bulanan?user_id=${userId}`);
      const result = await res.json();
      if (result.status === 'success') {
        penjualanData   = result.data.penjualanBulanan;
        pengeluaranData = result.data.pengeluaranBulanan;
      }
    } catch (e) {
      console.warn('Gagal memuat data grafik dashboard:', e);
    }

    const optionsDashboard = {
      series: [
        { name: 'Penjualan',   data: penjualanData },
        { name: 'Pengeluaran', data: pengeluaranData },
      ],
      colors: ['#E66239', '#f7a085'],
      chart: {
        type: 'bar', height: 350, width: '100%',
        parentHeightOffset: 0, toolbar: { show: false },
      },
      grid: { show: true, borderColor: '#e2e8f0' },
      legend: {
        show: true, fontFamily: 'Poppins, serif', fontWeight: 500,
        markers: { size: 5, shape: 'square', strokeWidth: 0 },
      },
      plotOptions: {
        bar: { horizontal: false, columnWidth: '65%', borderRadius: 3, borderRadiusApplication: 'end' },
      },
      dataLabels: { enabled: false },
      stroke: { show: false },
      xaxis: {
        categories: namaBulan,
        axisBorder: { show: false }, axisTicks: { show: false },
      },
      yaxis: {
        labels: { formatter: (val) => formatRupiah(val) },
        title: { text: 'Rupiah (IDR)' },
      },
      fill: { opacity: 1 },
      tooltip: { y: { formatter: (val) => formatRupiah(val) } },
    };

    const chartDashboard = new ApexCharts(document.querySelector('#salesPurchaseChart'), optionsDashboard);
    chartDashboard.render();
  }

 


  if (document.getElementById('salesChart')) {
    let penjualanTahunIni = Array(12).fill(0);
    let pembelianTahunIni  = Array(12).fill(0);

    try {
      const res = await fetch(`http://localhost:5000/api/laporan/grafik-bulanan?user_id=${userId}`);
      const result = await res.json();
      if (result.status === 'success') {
        penjualanTahunIni = result.data.penjualanBulanan;
        pembelianTahunIni = result.data.pembelianBulanan;

        const fmt   = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

        setEl('stat-total-penjualan',  fmt(result.data.totalPenjualan));
        setEl('stat-total-pembelian',  fmt(result.data.totalPembelian));
        setEl('stat-total-keuntungan', fmt(result.data.totalKeuntungan));
        setEl('stat-produk-terjual',   result.data.produkTerjual.toLocaleString('id-ID') + ' unit');
        setEl('stat-stok-rendah',      result.data.stokRendah);
        setEl('stat-stok-habis',       result.data.stokHabis);
      }
    } catch (e) {
      console.warn('Gagal memuat data laporan:', e);
    }

    const optionsLaporan = {
      chart: {
        id: 'laporan-penjualan', type: 'area', height: 420,
        zoom: { enabled: false }, toolbar: { show: false },
      },
      colors: ['#E66239', '#198754'],
      stroke: { width: [3, 2.5], curve: 'smooth' },
      markers: { size: 4, hover: { sizeOffset: 2 } },
      series: [
        { name: 'Penjualan',           data: penjualanTahunIni },
        { name: 'Pengeluaran / Modal', data: pembelianTahunIni },
      ],
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, inverseColors: false, opacityFrom: 0.45, opacityTo: 0.05, stops: [20, 60, 100] },
      },
      yaxis: {
        labels: { formatter: (val) => formatRupiah(val) },
        title: { text: 'Rupiah (IDR)' },
      },
      xaxis: { categories: namaBulan, tickPlacement: 'on' },
      tooltip: { shared: true, y: { formatter: (val) => formatRupiah(val) } },
      legend: { position: 'top', horizontalAlign: 'right' },
      responsive: [{
        breakpoint: 640,
        options: { chart: { height: 340 }, legend: { position: 'bottom', horizontalAlign: 'center' } },
      }],
    };

    const chartLaporan = new ApexCharts(document.querySelector('#salesChart'), optionsLaporan);
    chartLaporan.render();

    let tampilKeduanya = true;
    const btnUpdate = document.getElementById('btn-update');
    if (btnUpdate) {
      btnUpdate.addEventListener('click', () => {
        if (tampilKeduanya) {
          chartLaporan.updateSeries([{ name: 'Penjualan', data: penjualanTahunIni }]);
          btnUpdate.textContent = 'Tampilkan Perbandingan';
        } else {
          chartLaporan.updateSeries([
            { name: 'Penjualan',           data: penjualanTahunIni },
            { name: 'Pengeluaran / Modal', data: pembelianTahunIni },
          ]);
          btnUpdate.textContent = 'Tampilkan Penjualan Saja';
        }
        tampilKeduanya = !tampilKeduanya;
      });
    }
  }
});
