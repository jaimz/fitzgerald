// This code runs within the stats webview itself.
// We communicate with vs code proper via web-worker message passing
(function () {

  function start() {
    // noinspection JSUnresolvedFunction
    const vscode = acquireVsCodeApi();
    console.dir(vscode);

    let haveErrored = false;
    let cleared = false;

    const warningBar = document.getElementById('warningBar');
    const emptyState = document.getElementById('emptyState');
    const difficultWordsPanel = document.getElementById('difficultWords');
    const difficultWordCount = document.getElementById('difficultWordCount');
    const gaugePointer = document.getElementById('gaugePointer');
    const gaugeLabel = document.getElementById('gaugeLabel');

    const MAX_READING_EASE = 121.22;

    const refreshPanel = (statKey, stat) => {
      const countEl = document.querySelector(`[data-stat-name=${statKey}]`);
      if (countEl) {
        countEl.innerText = `${stat}`;
        countEl.parentElement.classList.remove('hidden');
      } else {
        console.warn("Could not find view for stat ", statKey);
      }
    };

    const clickedDifficultWord = (e) => {
      const wordEl = e.currentTarget;
      const word = wordEl.dataset['word'];
      if (word) {
        console.log('Clicked difficult word: ', word);
      }
    };

    const refreshGauge = (readingEase) => {
      const readingEasePc = (readingEase / MAX_READING_EASE) * 100;
      if (gaugePointer) { gaugePointer.style.left = `${readingEasePc}%`; }
      if (gaugeLabel) {
        gaugeLabel.innerText = `${readingEase}`;
        gaugeLabel.style.left = `${readingEasePc}%`;
      }
    };

    const refreshDifficultWords = (words) => {
      if (!difficultWordsPanel) { return; }

      const currentList = difficultWordsPanel.querySelector('.difficult-word-list');
      const currentCells = currentList.querySelectorAll('.difficult-word');
      for (const cell of currentCells) {
        cell.removeEventListener('click', clickedDifficultWord);
      }
      if (currentList) { currentList.remove(); }

      const newList = document.createElement("div");
      newList.classList.add("difficult-word-list");
      const wordDivs = words.map((word) => {
        let el = document.createElement("div");
        el.classList.add('difficult-word');
        el.dataset['word'] = word;

        let selectedMarkerEl = document.createElement('span');
        selectedMarkerEl.innerText = '•';
        selectedMarkerEl.classList.add('selected-marker');

        let wordEl = document.createElement('span');
        wordEl.innerText = word;
        wordEl.classList.add('word');

        el.insertAdjacentElement('beforeend', selectedMarkerEl);
        el.insertAdjacentElement('beforeend', wordEl);

        el.addEventListener('click', clickedDifficultWord);

        return el;
      });

      for (const d of wordDivs) {
        newList.insertAdjacentElement('afterbegin', d);
      }

      // Note in real life we would be more worried about performance throughout
      // this method.
      difficultWordsPanel.insertAdjacentElement('beforeend', newList);
      if (difficultWordCount) {
        difficultWordCount.innerText = `${words.length}`;
      }
    };

    const refreshWithStats = (stats = {}) => {
      if (haveErrored) {
        warningBar.classList.remove('visible');
        haveErrored = false;
      }

      if (cleared) {
        if (emptyState) { emptyState.classList.remove('visible'); }
        cleared = false;
      }

      for (const [statKey, stat] of Object.entries(stats)) {
        refreshPanel(statKey, stat);
      }

      const { difficultWords = [], flesch = 0 } = stats;
      refreshGauge(flesch);
      refreshDifficultWords(difficultWords);
    };

    const hideAllStatPanels = () => {
      const statPanels = document.querySelectorAll('.stat-panel');
      for (const panel of statPanels) {
        panel.classList.add('hidden');
      }
    };

    const showError = (errorMessage = "Unknown error") => {
      if (warningBar) {
        hideAllStatPanels();
        warningBar.innerText = errorMessage;
        warningBar.classList.add('visible');
        haveErrored = true;
      }

      console.error(errorMessage);
    };

    const clear = () => {
      hideAllStatPanels();
      if (emptyState) { emptyState.classList.add('visible'); }
      cleared = true;
    };

    window.addEventListener('message', event => {
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
        case 'clear':
          clear();
          break;
        default:
          console.warn('unrecognized command: ', message.command);
          break;
      }
    });
  }

  window.addEventListener('DOMContentLoaded', start);

}());