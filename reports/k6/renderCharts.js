async function chartBar() {
  const req = await fetch('chartJSData.json')
  const datasets = await req.json()
  console.log('all datasets', datasets)

  const ctx = document.getElementById('chart')
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['avg', 'max', 'med', 'min', 'p(90)', 'p(95)'],
      datasets: datasets,
    },
    options: {
      plugins: {
        colorschemes: {
          scheme: 'tableau.Classic10',
        },
      },
      legend: {
        display: true,
        position: 'top',
        labels: {
          boxWidth: 40,
          fontColor: 'black',
          fontSize: 20,
        },
        tooltips: {
          mode: 'index',
        },
      },
      scales: {
        yAxes: [
          {
            scaleLabel: {
              labelString: 'Response Time (ms)',
              fontSize: 25,
              display: true,
            },
            ticks: {
              fontSize: 20,
              beginAtZero: true,
            },
          },
        ],
        xAxes: [
          {
            ticks: {
              fontSize: 20,
              autoSkip: false,
            },
          },
        ],
      },
    },
  })
}

window.onload = () => chartBar()
