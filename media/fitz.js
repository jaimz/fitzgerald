// This code runs within the stats webview itself and manages the display of incoming
// statistics.
// We communicate with vs code proper via web-worker message passing.
(function () {

  // Called when we know the DOM is ready (i.e. the extension has passed some initial content)
  function start() {
    // noinspection JSUnresolvedFunction
    const vscode = acquireVsCodeApi();

    // True if the last update from the extension was an error message
    let haveErrored = false;

    // True if the last update from the extension was a "clear" message
    let cleared = false;

    // Look up various bits of UI
    const warningBar = document.getElementById('warningBar');
    const emptyState = document.getElementById('emptyState');
    const difficultWordsPanel = document.getElementById('difficultWords');
    const difficultWordCount = document.getElementById('difficultWordCount');
    const gaugePointer = document.getElementById('gaugePointer');
    const gaugeLabel = document.getElementById('gaugeLabel');

    // The maximum a reading ease score can be. Heaven knows how they get to this number.
    const MAX_READING_EASE = 121.22;

    // Refresh a particular statistics panel
    const refreshPanel = (statKey, stat) => {
      const countEl = document.querySelector(`[data-stat-name=${statKey}]`);
      if (countEl) {
        countEl.innerText = `${stat}`;
        countEl.parentElement.classList.remove('hidden');
      } else {
        console.warn("Could not find view for stat ", statKey);
      }
    };

    // Update the reading ease gauge.
    const refreshGauge = (readingEase) => {
      const readingEasePc = (readingEase / MAX_READING_EASE) * 100;
      if (gaugePointer) { gaugePointer.style.left = `${readingEasePc}%`; }
      if (gaugeLabel) {
        gaugeLabel.innerText = `${readingEase}`;
        gaugeLabel.style.left = `${readingEasePc}%`;
      }
    };

    const refreshGradeNumber = (grade) => {
      const gradeEl = document.querySelector('.grade-number');
      const gradeSfxEl = document.querySelector('.grade-sfx');

      // Fortunately we don't have to worry about "112nd" grade
      let sfx = "th";
      switch (grade) {
        case 1:
          sfx = "st";
          break;
        case 2:
          sfx = "nd";
          break;
        case 3:
          sfx = "rd";
          break;
      }

      if (gradeEl) {
        gradeEl.innerText = `${grade}`;
      } else {
        console.warn("No grade el?");
      }
      
      if (gradeSfxEl) {
        gradeSfxEl.innerText = sfx;        
      } else {
        console.warn("No grade sfx el?");
      }
      
    };

    // Update the list of difficult words.
    const refreshDifficultWords = (words) => {
      if (!difficultWordsPanel) { return; }

      const currentList = difficultWordsPanel.querySelector('.difficult-word-list');
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

    // Refresh the display with some new statistics
    const refreshWithStats = (stats = {}) => {
      if (haveErrored) {
        warningBar.classList.remove('visible');
        haveErrored = false;
      }

      if (cleared) {
        if (emptyState) { emptyState.classList.remove('visible'); }
        cleared = false;
      }

      // Flesch score, grade, and difficult words are treated differently from teh other stats
      const { difficultWords = [], grade = 1, flesch = 0, ...rest } = stats;
      for (const [statKey, stat] of Object.entries(rest)) {
        refreshPanel(statKey, stat);
      }

      refreshGradeNumber(grade);
      refreshGauge(flesch);
      refreshDifficultWords(difficultWords);
    };

    // Hide all the stats panels (because the display has been cleared due to the user
    // focusing an in-appropriate editor)
    const hideAllStatPanels = () => {
      const statPanels = document.querySelectorAll('.stat-panel');
      for (const panel of statPanels) {
        panel.classList.add('hidden');
      }
    };

    // Show an error sent by the extension (usually something went wrong calculating the stats)
    const showError = (errorMessage = "Unknown error") => {
      if (warningBar) {
        hideAllStatPanels();
        warningBar.innerText = errorMessage;
        warningBar.classList.add('visible');
        haveErrored = true;
      }

      console.error(errorMessage);
    };

    // Clear the stats. (The user has probably not focused a text document)
    const clear = () => {
      hideAllStatPanels();
      if (emptyState) { emptyState.classList.add('visible'); }
      cleared = true;
    };

    // Listen for messages incoming from the extension
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