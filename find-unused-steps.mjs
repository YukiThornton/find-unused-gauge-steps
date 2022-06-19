#!/usr/bin/env zx

/*
    Usage: npm run exec <path to gauge project>
    Example: npm run exec ../sample-e2e
*/

import { $ } from 'zx';
import 'zx/globals';

const path = require('node:path');
$.verbose = false;

function createDefinition(stepName, pattern) {
    return {stepName, pattern}
}

function createStepNamePattern(name) {
    return `^\\*\\s+${name.replaceAll(/\<.*?\>/g, "\.\+")}\\s*$`
}

function createDefinitions(stepNames) {
    return stepNames.map(stepName => createDefinition(stepName, createStepNamePattern(stepName)))
}

function convertToStepNames(line) {
    return createDefinitions(line.match(/\".*?\"/g).map(stepName => stepName.replaceAll("\"", "")))
}

async function findSteps(srcDir) {
    const rawSteps = await $`find ${srcDir} -name "*kt" | xargs cat | awk '/@Step/,/\)/' | awk '/,$/ { printf("%s", $0); next } 1' | grep -o '".*"'`
    return rawSteps.stdout.split("\n").filter(line => line.length > 0 ).map(line =>  convertToStepNames(line))
}

async function findConcepts(specsDir) {
    const result = await $`find ${specsDir} -name "*.cpt"`
    if (result.stdout.trim().length == 0) {
        return []
    }

    const rawConcepts = await $`find ${specsDir} -name "*.cpt" | xargs cat | grep -oE '^\\#\\s+.*\\s*$'`
    return rawConcepts.stdout.trim().split("\n")
            .map(concept => concept.replaceAll('#', '').trim())
            .map(concept => createDefinition(concept, createStepNamePattern(concept)))
}

async function formatForStepSearch(specsDir) {
    const specFiles = await findSpecFiles(specsDir);

    const promises = specFiles.map(async file => {
        // Add a newline if the file does not end with a newline.
        $`[ $(tail -c1 ${file} | wc -l) -eq 0 ] && echo >> ${file} || :`
    })
    await Promise.all(promises);
    console.log('Format done.\n');
}

async function findSpecFiles(specsDir) {
    const result = await $`find ${specsDir} -type f`
    return result.stdout.trim().split('\n');
}

async function isUnused(definition, specsDir) {
    try {
        await $`find ${specsDir} -type f -exec cat {} + | grep -E ${definition.pattern} | wc -l`;
        return false;
    } catch (e) {
        return true;
    }
}

async function findUnusedSteps(steps, specsDir) {
    const result = await Promise.all(steps.map(async step => {
        return await Promise.all(step.map(async definition => {
            const unused = await isUnused(definition, specsDir)
            return {...definition, unused: unused}
        }));
    }))

    return result.filter(step => step.some(definition => definition.unused))
}

function printUnusedSteps(steps) {
    console.log("Unused step names:")
    steps.forEach(step =>
        step.filter(definition => definition.unused)
            .forEach( definition => {
                console.log(`* ${definition.stepName}`);
            })
    );
    console.log("")
}

async function findUnusedConcepts(concepts, specsDir) {
    const result = await Promise.all(concepts.map(async concept => {
        const unused = await isUnused(concept, specsDir)
        return {...concept, unused: unused}
    }))

    return result.filter(concept => concept.unused)
}

function printUnusedConcepts(concepts) {
    console.log("Unused concepts:")
    concepts.forEach(concept => console.log(`# ${concept.stepName}`));
    console.log("")
}

function printSummary(steps, unusedSteps, concepts, unusedConcepts) {
    const stepNameCount = steps.reduce((sum, step) => sum + step.length, 0);
    const unusedStepNameCount = unusedSteps.reduce((sum, step) => sum + step.filter(def => def.unused).length, 0);
    console.log("------------------------------------------------------")
    if (unusedStepNameCount > 0 || unusedConcepts.length > 0) {
        console.log(`Unused steps: ${unusedSteps.length} / ${steps.length}`);
        console.log(`Unused step names: ${unusedStepNameCount} / ${stepNameCount}`);
        console.log(`Unused concepts: ${unusedConcepts.length} / ${concepts.length}`);
    } else {
        console.log("ALL CLEAN!")
    }
    console.log("------------------------------------------------------")
}

function printTarget(projectDir, srcDir, specsDir) {
    console.log("------------------------------------------------------")
    console.log("Target project directory: ", projectDir);
    console.log("Src directory: ", srcDir);
    console.log("Specs directory: ", specsDir);
    console.log("------------------------------------------------------")
}

async function exec(projectDir) {
    const srcDir = path.normalize(`${projectDir}/src/test/kotlin`);
    const specsDir = path.normalize(`${projectDir}/specs`);
    printTarget(projectDir, srcDir, specsDir);

    await formatForStepSearch(specsDir);

    const steps = await findSteps(srcDir);
    const unusedSteps = await findUnusedSteps(steps, specsDir);
    printUnusedSteps(unusedSteps);

    const concepts = await findConcepts(specsDir);
    const unusedConcepts = concepts.length > 0 ? await findUnusedConcepts(concepts, specsDir) : [];
    printUnusedConcepts(unusedConcepts);

    printSummary(steps, unusedSteps, concepts, unusedConcepts);
}

function gaugeProjectDirectory() {
    const dir = process.argv[3];
    if (!dir) {
        console.error("ERROR: Specify project directory\nExecution aborted.");
        process.exit(1);
    }
    return dir;
}

exec(gaugeProjectDirectory());
