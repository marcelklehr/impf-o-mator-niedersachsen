// Establish a Socket.io connection
const socket = io();
// Initialize our Feathers client application through Socket.io
// with hooks and authentication.
const client = feathers();

client.configure(feathers.socketio(socket));

// Setup screen
const setupHTML = `<main class="setup container">
<div class="hero is-primary">
<div class="hero-body">
  <h1 class="title block">Impf-o-mat Niedersachsen</h1>
  <div class="subtitle">Der Impf-o-mat informiert Sie, wenn Impftermine in Ihrer Region frei werden.</div>
</div>
</div>
  <div class="section mt-5">
  <form class="form">
    <label class="label">Postleitzahl eingeben
      <input class="block input" type="text" name="id" placeholder="PLZ">
    </label>

    <button type="button" id="setup" class="button is-primary block signup">
      Ich will geimpft werden.
    </button>
  </form>
  </div>
</main>
<footer class="footer">
  <div class="content has-text-centered">
    <p>
      <strong>Impf-o-mat Niedersachsen</strong> von <a href="https://marcelklehr.de">Marcel Klehr</a>. Dieser Service gehört nicht zum Land Niedersachsen.
    </p>
  </div>
</footer>`;

const mainHTML = `<main class="main container">
<div class="hero is-primary">
<div class="hero-body">
  <h1 class="title block">Impf-o-mat Niedersachsen</h1>
  <div class="subtitle">Der Impf-o-mat informiert Sie, wenn Impftermine in Ihrer Region frei werden.</div>
</div>
</div>
  <div class="section mt-5 results">
  <h2 class="title">Warte auf Impftermine in <span id="plz"></span></h2>
  <div class="subtitle">Sie können diese Seite im Hintergrund geöffnet lassen und auf eine Benachrichtigung warten.</div>
  <progress class="progress is-small is-primary" max="100">0%</progress>
  </div>
</main>
<footer class="footer">
  <div class="content has-text-centered">
    <p>
      <strong>Impf-o-mat Niedersachsen</strong> von <a href="https://marcelklehr.de">Marcel Klehr</a>. Dieser Service gehört nicht zum Land Niedersachsen.
    </p>
  </div>
</footer>`;

const showSetup = (error) => {
    if(document.querySelectorAll('.setup').length && error) {
        document.querySelector('.heading').insertAdjacentHTML('beforeend', `<p>There was an error: ${error.message}</p>`);
    } else {
        document.getElementById('app').innerHTML = setupHTML;
    }
};

// Shows the main page
const showMain = async () => {
    document.getElementById('app').innerHTML = mainHTML;
    document.getElementById('plz').innerHTML = Object.keys(subscriptions)[0];
};

const addNotification = center => {
    const results = document.querySelector('.results');

    if(results) {
        results.innerHTML = `<div class="message is-primary">
<div class="message-header">
      <h2 class="title">Freie Impftermine in ${center.city} gefunden</h2>
</div>
      <div class="message-body">
        <p>Öffnen Sie jetzt das <a href="https://impfportal-niedersachsen.de">Impfportal Niedersachsen</a>, um einen Termin zu buchen.</p>
        <a class="button is-primary mt-3">Impfportal öffnen</a>
      </div>
    </div>`;
    }
    new Notification(`Freie Impftermine in ${center.city} gefunden`)
};

// Retrieve post code from setup page
const getSetupData = () => {
    const region = {
        id: document.querySelector('[name="id"]').value,
    };

    return region;
};

const subscriptions = {}
const subscribe = async (region) => {
    subscriptions[region.id] = true
}

const onUpdate = async (region) => {
  if (!subscriptions[region.id]) {
      return
  }
  const stockedCenters = region.result.filter(result => !result.outOfStock)
    stockedCenters.forEach(center => addNotification(center))
    if (stockedCenters.length) {
        delete subscriptions[region.id]
    }
}

const addEventListener = (selector, event, handler) => {
    document.addEventListener(event, async ev => {
        if (ev.target.closest(selector)) {
            handler(ev);
        }
    });
};

addEventListener('#setup', 'click', async () => {
    const regionData = getSetupData();

    let region = await client.service('regions').get(regionData.id)
    if (!region) {
        region = await client.service('regions').create(regionData)
    }else{
        await client.service('regions').update(region.id, {count: region.count+1})
    }

    await subscribe(region)
    showMain()
    window.Notification.requestPermission()
});

client.service('regions').on('updated', onUpdate);

showSetup()
