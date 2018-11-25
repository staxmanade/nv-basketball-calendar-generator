const cheerio = require('cheerio'); // Basically jQuery for node.js
const fs = require('fs');
const url = 'https://nevadawolfpack.com/schedule.aspx?schedule=343';
const ics = require('ics');
const exec = require('child_process').execSync;

// get the schedule
exec(`curl ${url} > schedule.html`);

const fileBody = fs.readFileSync('./schedule.html').toString();

const $ = cheerio.load(fileBody);

function loadData() {
    // let's hack in there and find the JSON data in some Javascript and use it...
    return $('.row.pad script:first-child').map((i, el) => {
        let txt = $(el).html().trim();
        txt = txt.substring(txt.indexOf('{'), txt.indexOf('};') + 1);
        const data = JSON.parse(txt);
        return data.data;
    }).toArray();
}

const data = loadData()
    .filter(item => item.type === 'upcoming')
    .map(item => {
        //    console.log(item);

        const isHome = item.location_indicator === 'H';

        const tv = item.media && item.media.tv || 'Channel Unknown';
        const title = `${isHome ? 'At home VS' : 'Away at'} ${item.opponent.title.trim()} (${tv})`

        const dateString = item.date.substr(0, 10) + ' ' + item.time.replace('p.m.', 'pm').replace('a.m.', 'am');
        const date = new Date(dateString);

        if (isNaN(date.getFullYear())) {
            console.log(item);
            throw `Error composing date with "${dateString}"...`;
        }

        const start = [
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
            date.getHours(),
            date.getMinutes()
        ];

        if (start.slice(0, start.length-1).some(item => isNaN(item) || item === 0)) {
            throw `Error composing date with "${dateString}"... [${start.join(', ')}]` + new Date(dateString);
        }

        const description = `
Nevada ${title}

Watch on tv at: ${tv}

In ${item.location} ${item.facility ? 'at ' + item.facility.title : ''}

`;
        return {
            //_raw: item,
            title,
            duration: { hours: 2, minutes: 30 },
            start,
            location: item.location,
            url,
            description,
            status: 'CONFIRMED',
            categories: ['Nevada Mens Basketball', isHome ? "Home Game" : "Away Game"],
            // organizer: { name: "Jason Jarrett", email: "" },
            // attendees: [
            //     { name: "", email: "" }
            // ]
        }
    });

// output each as an individual file (but seems to be buggy because it uses the same UID)
//
// Promise.all(data.map(item => {
//     const fileName = item._raw.date.substr(0, 10) + "-Nevda-vs-" + item._raw.opponent.title.trim().replace(/ /g, '-') + '.ics';
//     const raw = item._raw;
//     delete item._raw;
//     return new Promise((resolve, reject) => {
//         ics.createEvent(item, (error, value) => {
//             if (error) {
//                 console.log("JJ", raw);
//                 console.log(error)
//                 return reject(error);
//             }
//             resolve({
//                 name: fileName,
//                 ical: value
//             });
//         });
//     });
// })).then(results => {
//     console.log(results);
//     results.forEach(item => {
//         fs.writeFileSync('./ical-items/' + item.name, item.ical);
//     });
// });

const allEvents = data;

ics.createEvents(allEvents, (error, value) => {
    if (error) {
        console.log(error)
        return;
    }
    const fileName = 'NevdaBasketball.ics';
    console.log("Events created in :", fileName);
    fs.writeFileSync(fileName, value);
});
