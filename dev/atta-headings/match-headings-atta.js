/**
 * find new titles for headings in atta by copying from mula
 * 1) copy the aligned atta file to public/text folder
 * 2) run build-tree to generate keys for the new file
 * 3) run this script and check diff and replace files for errors
 * 4) copy the output json file to public/text folder
 * 5) run build-tree again to pickup new headings
 */

const fs = require('fs')
const vkb = require('vkbeautify')
const path = require('path')

// following files were not processed - dn, mn-1 - headings were already good or copied manually
const filename = 'atta-kn-ap'
const isSimpleCopy = false // simply copy the headings without any modification
    sinhalaTitlesOnly = false // modify only sinhala titles
    emptyTitlesOnly = true // fill in only the empty headings
const tree = JSON.parse(fs.readFileSync(__dirname + '/../../public/static/data/tree.json', { encoding: 'utf-8' }))
const keysToProcess = Object.keys(tree).filter(k => (tree[k][5] == filename && tree[k][2] <= 4))
const data = JSON.parse(fs.readFileSync(`${__dirname}/../../public/static/text/${filename}.json`, { encoding: 'utf-8' }))
console.log(`Processing ${keysToProcess.length} keys for file ${filename}`)


const diff = [], replaceMap = [], dryRun = false
keysToProcess.forEach(akey => {
    if (!akey.startsWith('atta-')) return
    
    const level = tree[akey][2], attaH = tree[akey][0]
    const [pi, ei] = tree[akey][3], page = data.pages[pi], pEnt = page.pali.entries[ei], sEnt = page.sinh.entries[ei]
    console.assert(pEnt.text.charAt(0) == attaH.charAt(0),
        `name from file(${pEnt.text}) and tree(${attaH}) not matching for key ${akey}`)
    
    const key = akey.substr(5) // remove atta part
    if (!tree[key]) {
        console.error(`no mula for ${key}, ${attaH}`)
        return
    } else if (tree[key][2] != level && (level == 1 || tree[key][2] == 1)) {
        console.error(`level mismatch for ${key}, ${attaH}. ${level} and ${tree[key][2]}`)
    }
    const mulaRes = /^([\d\-\. ]*)(.*)$/.exec(tree[key][0]) // remove digits if any
    const attaRes = /^([\d\-\. ]*)(.*)$/.exec(pEnt.text)
    if (!attaRes) {
        console.error(`Malformed atta heading ${attaH}`)
        return
    }
    if (attaRes[2].trim() && mulaRes[2].search(attaRes[2].substr(0, 3)) == -1) {
        diff.push(`name mismatch,${key},${level},${attaH},${mulaRes[2]}`)
    }

    const attaDigit = attaRes[1].trim() ? (attaRes[1].trim() + ' ') : '', isRange = attaRes[1].indexOf('-') >= 0
    if (sinhalaTitlesOnly) { // do nothing
    } else if (isSimpleCopy) { 
        if (level > 1) pEnt.text = tree[key][0]
    } else if (mulaRes[2].trim()) { // only if mula name is non empty
        if (level == 1 && !/සුත්(තං|තානි)$/.test(mulaRes[2])) { 
            //diff.push(`pali not sutta,${key},${level},${attaH},${mulaRes[2]}`)
            //return // do not replace
        }
        const newPaliH = level > 1 ? tree[key][0] : (attaDigit + getPaliVanna(isRange, mulaRes[2], level))
        if (pEnt.text != newPaliH)
            replaceMap.push(`${key}\t\tpali\t\t${pEnt.text}\t\t${newPaliH}`)
        pEnt.text = newPaliH
    }

    // sinhala heading
    const msinhRes = /^([\d\-\. ]*)(.*)$/.exec(tree[key][1]) // remove digits if any
    if (emptyTitlesOnly && sEnt.text.trim()) { // do nothing
    } else if (isSimpleCopy) {
        sEnt.text = tree[key][1]
    } else if (msinhRes[2].trim()) {
        if (level == 1 && !/සූත්‍රය|පෘච්ඡා?$/.test(msinhRes[2])) {
            //diff.push(`sinh not suttra,${key},${level},${tree[akey][1]},${msinhRes[2]}`)
            //return
        }
        const newSinhH = level > 1 ? tree[key][1] : (attaDigit + getSinhVanna(isRange, msinhRes[2], level))
        sEnt.text = newSinhH
        //console.log(newSinhH)
    }
})

if (!dryRun) {
    fs.writeFileSync(path.join(__dirname, 'output', `${filename}.json`), vkb.json(JSON.stringify(data)), {encoding: 'utf-8'})
}
fs.writeFileSync(path.join(__dirname, 'diff', `${filename}-replace.txt`), replaceMap.join('\n'), {encoding: 'utf-8'})
fs.writeFileSync(path.join(__dirname, 'diff', `${filename}-diff.txt`), diff.join('\n'), {encoding: 'utf-8'})

function getPaliVanna(isRange, mulaName) { // vannana or suttadivannana for level 1
    let newHeading = mulaName + 'වණ්ණනා' // -සුත්තානිවණ්ණනා
    if (/සුත්තං|විමානං$/.test(mulaName)) {
        const ending = isRange ? 'ාදිවණ්ණනා' : 'වණ්ණනා'
        newHeading = mulaName.replace(/ං$/, ending)
    }
    return newHeading.replace(/ආදිසුත්තවණ්ණනා|ආදිසුත්තාදිවණ්ණනා/, 'සුත්තාදිවණ්ණනා')
}

function getSinhVanna(isRange, mulaName) {
    let newHeading = mulaName.replace(/ යි$/, '') + ' වර්ණනාව' // -විමාන යි -> විමාන වර්ණනා
    if (mulaName.endsWith('සූත්‍රය')) {
        const ending = isRange ? 'ආදි සූත්‍ර වර්ණනා' : 'සූත්‍ර වර්ණනාව'
        newHeading = mulaName.replace(/සූත්‍රය$/, ending)
    } else if (mulaName.endsWith('පදය')) {
        newHeading = mulaName.replace(/පදය$/, 'පද වර්ණනාව') // දෙවන සිකපදය -> දෙවන සිකපද වර්ණනාව
    }
    return newHeading.replace(/ආදි ආදි/, 'ආදි')
}