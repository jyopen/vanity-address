#!/usr/bin/env node
// Copyright 2017-2019 @polkadot/app-accounts authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.


const  yargs  = require('yargs');
const  chalk  = require('chalk');
const  { u8aToHex }  = require('@polkadot/util');
const  { cryptoWaitReady, setSS58Format }  = require('@polkadot/util-crypto');

const  generator  = require('.');
const  matchRegex  = require('./regex');

const { match, mnemonic, network, type, withCase } = yargs
  .option('match', {
    default: 'Test',
    type: 'string'
  })
  .option('mnemonic', {
    default: false,
    type: 'boolean'
  })
  .option('network', {
    choices: ['substrate', 'polkadot', 'kusama'],
    default: 'substrate'
  })
  .option('type', {
    choices: ['ed25519', 'sr25519'],
    default: 'sr25519'
  })
  .option('withCase', {
    default: false,
    type: 'boolean'
  })
  .argv;

const INDICATORS = ['|', '/', '-', '\\'];
const NUMBER_REGEX = new RegExp('(\\d+?)(?=(\\d{3})+(?!\\d)|$)', 'g');

const options = {
  match,
  network,
  runs: 50,
  type: type,
  withCase,
  withHex: !mnemonic
};
const startAt = Date.now();
let best = {
  address: '',
  count: -1,
  offset: 65536
};
let total = 0;
let indicator = -1;
const tests = options.match.split(',');

tests.forEach((test) => {
  if (!matchRegex.test(test)) {
    console.error("Invalid character found in match string, allowed is '1-9' (no '0'), 'A-H, J-N & P-Z' (no 'I' or 'O'), 'a-k & m-z' (no 'l') and '?' (wildcard)");
    process.exit(-1);
  }
});

switch (network) {
  case 'kusama':
    setSS58Format(2);
    break;

  case 'polkadot':
    setSS58Format(0);
    break;

  default:
    setSS58Format(42);
    break;
}

console.log(options);

function showProgress () {
  const elapsed = (Date.now() - startAt) / 1000;

  indicator++;

  if (indicator === INDICATORS.length) {
    indicator = 0;
  }

  process.stdout.write(`\r[${INDICATORS[indicator]}] ${(total.toString().match(NUMBER_REGEX) || []).join(',')} keys in ${(elapsed).toFixed(2)}s (${(total / elapsed).toFixed(0)} keys/s)`);
}

function showBest () {
  const { address, count, mnemonic, offset, seed } = best;

  console.log(`\r::: ${address.slice(0, offset)}${chalk.cyan(address.slice(offset, count + offset))}${address.slice(count + offset)} <= ${u8aToHex(seed)} (count=${count}, offset=${offset})${mnemonic ? '\n                                                        ' + mnemonic : ''}`);
}

cryptoWaitReady()
  .then(() => {
    while (true) {
      const nextBest = generator(options).found.reduce((best, match) => {
        if ((match.count > best.count) || ((match.count === best.count) && (match.offset <= best.offset))) {
          return match;
        }

        return best;
      }, best);

      total += options.runs;

      if (nextBest.address !== best.address) {
        best = nextBest;
        showBest();
        showProgress();
      } else if ((total % (options.withHex ? 1000 : 100)) === 0) {
        showProgress();
      }
    }
  })
  .catch((error) => console.error(error));
