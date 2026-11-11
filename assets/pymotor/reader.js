(function () {
  'use strict';
  const mounts = {
    overview: 'mountOverview', startup: 'mountStartup', request: 'mountRequest',
    scheduling: 'mountScheduling', affinity: 'mountAffinity', streaming: 'mountStreaming',
    node: 'mountNode', recovery: 'mountRecovery', metrics: 'mountMetrics'
  };
  for (const root of document.querySelectorAll('[data-pm-lab]')) {
    const mount = window.PyMotorLabs && window.PyMotorLabs[mounts[root.dataset.pmLab]];
    if (typeof mount === 'function') mount(root);
  }
  const rail = document.querySelector('.pm-rail details');
  if (rail && window.matchMedia('(max-width: 900px)').matches) rail.open = false;
})();
