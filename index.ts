import '@logseq/libs'
import { LSPluginBaseInfo, SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin'
import * as Grammarly from "@grammarly/editor-sdk";

const header = '#logseq-grammarly'
let grammarly = null;
let enableGrammarly = false;

async function tryInitializeGrammarlyIfNotExist () {
  if (grammarly || !logseq.settings.GrammarlyClientID) return;

  grammarly = await Grammarly.init(logseq.settings.GrammarlyClientID);
  if (grammarly) {
    console.log(header + ': Grammarly initialized');
  }
}

// throttle MutationObserver
// from https://stackoverflow.com/a/52868150
const throttle = (func: any, limit: number) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = setTimeout(() => (inThrottle = false), limit);
    }
  };
};

const callback = (mutationList, observer) => {
  if (!enableGrammarly) return;
  if (!logseq.settings.GrammarlyClientID || !grammarly) return;

  for (let mutation of mutationList) {
    // Left here for future variation
    if (mutation.type == 'childList') {
      continue;

    // Attaching editor plugin textarea in editing block.
    // They'll be grammarly-textarea after attaching.
    } else if (mutation.type === 'attributes'
               && mutation.target.nodeName === 'TEXTAREA'
             && mutation.target.ariaLabel === 'editing block') {
               console.log(header + ': Attaching Grammarly Editor');
               grammarly.addPlugin(
                 mutation.target,
                 { activation: "immediate",
                   documentDialect: logseq.settings.GrammarlyDocumentDialect,
                   documentDomain: logseq.settings.GrammarlyDocumentDomain,
                   autocomplete: logseq.settings.GrammarlyAutocomplete ? "on" : "off",
                   toneDetector: logseq.settings.GrammarlyToneDetector ? "on" : "off" },
               );
             }
  }
};

const settingsSchema: Array<SettingSchemaDesc> = [
  {
    key: 'GrammarlyClientID',
    type: 'string',
    title: 'Grammarly Desktop Client ID',
    description: 'Please use the Desktop Client ID from Grammarly\'s API console',
    default: 'client_4z3DAyDBBVi3x6yZTa6jaV'
  },
  {
    key: "GrammarlyAutocomplete",
    type: 'boolean',
    title: 'Autocomplete',
    description: 'Whether to autocomplete phrase',
    default: false
  },
  {
    key: 'GrammarlyDocumentDialect',
    type: 'enum',
    enumChoices: ['auto-browser', 'american', 'british', 'canadian', 'australian', 'auto-text'],
    enumPicker: 'select',
    title: 'Document Dialect',
    description: 'Dialect to use in documents',
    default: 'auto-browser'
  },
  {
    key: 'GrammarlyDocumentDomain',
    type: 'enum',
    enumChoices: ['academic', 'business', 'general', 'mail', 'casual', 'creative'],
    enumPicker: 'select',
    title: 'Document Domain',
    description: 'The domain of documents',
    default: 'general'
  },
  {
    key: "GrammarlyToneDetector",
    type: 'boolean',
    title: 'Tone Detector',
    description: 'Whether to enable tone detector',
    default: false
  },
]

// main entry
async function main (baseInfo: LSPluginBaseInfo) {
  // Do no need to use experimental features. Just leave it here for memo.
  // const host = logseq.Experiments.ensureHostScope();


  // Main logic
  let enable = enableGrammarly;
  if (enable) {
    await tryInitializeGrammarlyIfNotExist();
  }
  MutationObserver = parent.MutationObserver;
  const watchTarget = parent.document.getElementById("main-content-container");
  const observer = new MutationObserver(throttle(callback, 200));
  observer.observe(watchTarget, {
    attributes: true,
    subtree: true,
    //childList: true,
  });

  // Move the help-btn aside for grammarly button
  logseq.provideStyle('.cp__sidebar-help-btn { bottom: 1rem; position: fixed; right: 5rem;}')

  // Control Button to enable/disable Grammarly
  function createModel() {
    return {
      controlGrammarly
    };
  }
  logseq.provideModel(createModel());

  const triggerIconName = "ti-bell";

  logseq.App.registerUIItem('toolbar', {
    key: 'open-grammarly',
    template: `
    <a class="button" data-on-click="controlGrammarly" data-rect>
      <i class="ti ${triggerIconName}"></i>
    </a>
    `,
  })
  const css = (t, ...args) => String.raw(t, ...args);
  const enableColor = "#2cb673";
  const disableColor = "#6b7280";
  let backgroundColor = enable ? enableColor : disableColor;
  logseq.provideStyle(css`
  .${triggerIconName}:before {
    color: ${backgroundColor};
  }
  `);

  // the Toggling function
  async function controlGrammarly(e) {
    enable = !enable
    if (enable && !logseq.settings.GrammarlyClientID) {
      logseq.App.showMsg(
        header + ': Grammarly client ID empty\n' +
        'Please get a Desktop client ID from Grammarly API console\n' +
        'and setup in the plugin\'s configuration');
    }
    if (enable) {
      await tryInitializeGrammarlyIfNotExist();
    }

    enableGrammarly = enable;
    if(enable) {
      logseq.provideStyle(css`
      .${triggerIconName}:before {
        color: ${enableColor};
      }`);
    } else {
      logseq.provideStyle(css`
      .${triggerIconName}:before {
        color: ${disableColor};
      }`);
    }
  }
}

logseq.useSettingsSchema(settingsSchema).ready(main).catch(console.error)
