const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const socketio = require('@feathersjs/socketio');
const Parallel = require('async-parallel')
const zipCodes = require('german-zip-codes/data/data').data

const niedersachsenZips = zipCodes
    .filter(zip => zip.bundesland === 'Niedersachsen')
    .map(zip => zip.plz)

class RegionService {
    constructor() {
        this.regions = [];
    }

    async find () {
        return this.regions;
    }

    async get(id) {
        if (!niedersachsenZips.includes(parseInt(id))) {
            throw new Error('Ungültige Postleitzahl')
        }
        return this.regions.find(region => region.id === id)
    }

    async create (data) {
        if (!niedersachsenZips.includes(parseInt(data.id))) {
            throw new Error('Ungültige Postleitzahl')
        }

        const region = {
            id: data.id,
            count: 1,
            result: null
        }

        // Add new message to the list
        this.regions.push(region);

        return region;
    }

    async update (id, data) {
        const regionIdx = this.regions.findIndex(region => region.id === id)
        this.regions[regionIdx] = {...this.regions[regionIdx], ...data, id: this.regions[regionIdx].id}
        return this.regions[regionIdx]
    }
}

// Creates an ExpressJS compatible Feathers application
const app = express(feathers());

// Parse HTTP JSON bodies
app.use(express.json());
// Parse URL-encoded params
app.use(express.urlencoded({ extended: true }));
// Host static files from the current folder
app.use(express.static(__dirname+'/public'));
// Add REST API support
app.configure(express.rest());
// Configure Socket.io real-time APIs
app.configure(socketio());
// Register an in-memory messages service
app.use('regions', new RegionService());
// Register a nicer error handler than the default Express one
app.use(express.errorHandler());

// Add any new real-time connection to the `everybody` channel
app.on('connection', connection =>
    app.channel('everybody').join(connection)
);
// Publish all events to the `everybody` channel
app.publish(data => app.channel('everybody'));

// Start the server
app.listen(3030).on('listening', () =>
    console.log('Feathers server listening on localhost:3030')
);

const fetch = require('node-fetch')
const https = require('https')
const httpsAgent = new https.Agent({
    keepAlive: true
});

;(async () => {
    const regionsService = app.service('regions')
    do {
        const regions = await regionsService.find()
        await Parallel.each(regions, async region => {
            console.log('Fetching region', region.id)
            let body
            try {
                body = await new Promise(async (resolve, reject) => {
                    const req = await https.get(
                        `https://[2001:4d50:100:1e::20]/portal/rest/appointments/findVaccinationCenterListFree/${region.id}?stiko=&count=1`,
                        {
                            agent: httpsAgent,
                            setHost: false,
                            headers: {
                                'Host': 'www.impfportal-niedersachsen.de',
                                'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0',
                                Accept: 'application/json, text/plain, */*',
                                'Accept-Language': 'en',
                                'Authorization': '',
                                'DNT': '1',
                                'Referer': 'https://www.impfportal-niedersachsen.de/portal/'
                            }
                        },
                        res => {
                            res.setEncoding('utf8')
                            let body = ''
                            res.on('data', (chunk) => {
                                body += chunk
                            })
                            res.on('end', () => resolve(body))
                        }
                    )
                    req.on('error', reject)
                })
            }catch(e) {
                console.error(e)
            }
            try {
                body = JSON.parse(body)
            }catch(e) {
                console.warn('Error parsing response:')
                console.warn(body)
                return
            }
            console.log(body)
            if (body.succeeded) {
                await regionsService.update(region.id, {...region, result: body.resultList})
            }
        }, 2)
        await new Promise(resolve => setTimeout(resolve, 180000))
    } while(true)
})()
