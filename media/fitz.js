// This code runs within the stats webview itself.
// We communicate with vs code proper via web-worker message passing
(function () {
  
  function start() {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState();
    
    let haveErrored = false;
    
    const warningBar = document.getElementById('warningBar');
    
    const refreshPanel = (statKey, stat) => {
      const countEl = document.querySelector(`.stat-count[data-stat-name=${statKey}]`);
      if (countEl) {
        countEl.innerText = `${stat}`;
        countEl.parentElement.classList.remove('hidden');
      } else {
        console.warn("Could not find view for stat ", statKey);
      }
    }
    
    const refreshWithStats = (stats = {}) => {
      if (haveErrored) {
        warningBar.classList.remove('visible');
        haveErrored = false;
      }
      
      for (const [statKey, stat] of Object.entries(stats))
        refreshPanel(statKey, stat);
    }

    const hideAllStatPanels = () => {
      const statPanels = document.querySelectorAll('.stat-panel');
      for (const panel of statPanels) {
        panel.classList.add('hidden');
      }
    }
    
    const showError = (errorMessage = "Unknown error") => {
      if (warningBar) {
        hideAllStatPanels();
        warningBar.innerText = errorMessage;
        warningBar.classList.add('visible');
        haveErrored = true;
      }

      console.error(errorMessage);
    }
    
    window.addEventListener('message', event => {
      console.log("Got a message: ", event);
      
      const message = event.data;
      const {
        command, 
        stats, 
        errorMessage = null } = message;

      switch (command) {
        case 'refresh':
          refreshWithStats(stats);
          break;
        case 'error':
          showError(errorMessage);
          break;
        default:
          console.warn('unrecognized command: ', message.command);
          break;
      }
    });
  }
  
  window.addEventListener('DOMContentLoaded', start);
  
}());