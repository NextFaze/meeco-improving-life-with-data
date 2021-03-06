import 'rxjs/add/operator/switchMap';

import {Component} from '@angular/core';
import {Http, URLSearchParams} from '@angular/http';
import {ModalController, NavController} from 'ionic-angular';
import {combineLatest} from 'rxjs/observable/combineLatest';
import {of} from 'rxjs/observable/of';

import {Item} from '../../models/item';
import {Items} from '../../providers/providers';
import {ItemDetailPage} from '../item-detail/item-detail';

function domain_from_url(url) {
  var parser = document.createElement('a');
  parser.href = url;
  return parser;
}

import {OBP} from '../../providers/obp';

@Component({selector: 'page-list-master', templateUrl: 'list-master.html'})
export class ListMasterPage {
  trans: any;
  transactions$: any;
  domains$: any;
  data: any = {};
  localData: any = {};
  count = 0;
  txcount = 0;
  message: string;
  loading: boolean = true;

  constructor(
      public navCtrl: NavController, public items: Items, public modalCtrl: ModalController,
      public obp: OBP, public http: Http) {}

  ngOnInit() {
    this.transactions$ =
        this.obp.api.corePrivateAccountsAllBanks()
            .switchMap((accts: any) => {
              return combineLatest(accts.map((acct) => {
                return this.obp.api.accountById('owner', acct.id, acct.bank_id);
              }));
            })
            .switchMap((accts: any) => {
              this.message = `Searching ${accts.length} Accounts for available transactions`;
              let filtered =
                  accts.filter((acc) => acc.views_available.find((view) => view.id === 'owner'));
              return combineLatest(filtered.map((acct) => {
                return this.obp.api.getTransactionsForBankAccount('owner', acct.id, acct.bank_id)
                    .map((txs) => {
                      if (txs && txs.transactions.length) {
                        this.message = `Found ${
                                                this.txcount += txs.transactions.length
                                              } Transactions for Lost Rewards!`;
                      }
                      return txs;
                    });
              }));
            })
            .map(transactions => {

              let txs =
                  transactions.map(({transactions}) => transactions).reduce((a, b) => a.concat(b));
              txs = txs.reduce((a, b) => {
                a[b.other_account.metadata.URL] = [...a[b.other_account.metadata.URL] || [], b];
                return a;
              }, {});
              this.trans = txs;
              return Object.keys(txs);
            });

    this.domains$ =
        this.transactions$
            .switchMap((urls) => {
              this.count = urls.length;
              this.message = `Found ${this.count} Potential Reward Sources`;
              return combineLatest(urls.filter((url) => url !== 'null').map((url) => {
                let parsed = <any>domain_from_url(url);
                let search: URLSearchParams = new URLSearchParams();
                search.set('payload', parsed.origin);

                search.set('token', 'GHs4Qhzbf6Z7LxEVgNmCySW1uLqNdNDX');
                return this.http
                    .get(
                        `https://1nmzu2x2nk.execute-api.ap-southeast-2.amazonaws.com/dev/scrape`,
                        {search})
                    .catch(() => of({
                             text: function() {
                               return 'text';
                             }
                           }))
                    .map((res) => {
                      this.message = `${--this.count - 1} Potential Reward Sources Remain`;
                      return res.text();
                    })
                    .filter((val) => !!val)
                    .map((str) => {
                      let a = str.match(/href="([^\'\"]+)/g);
                      if (a === null) {
                        return [parsed.origin, []];
                      }
                      let b = a.map((val) => val.slice(6))
                                  .filter(
                                      (str) => str.includes('rewards') || str.includes('reward') ||
                                          str.includes('loyalty') || str.includes('membership'));
                      return [parsed.origin, b || []];
                    });
              }));
            })
            .map((payload) => {
              let count = payload
                              .map((pay) => {
                                let count = pay[1].length;
                                return count;
                              })
                              .reduce((a, b) => (a + b), 0);
              this.message = `Found ${count} Unclaimed Reward Sources`;
              this.loading = false;
              return payload;
            });
  }

  /**
   * The view loaded, let's query our items for the list
   */
  ionViewDidLoad() {}

  total(vals: any[]) {
    return vals.reduce((a, b) => {
      let c = a + +b.details.value.amount;
      return c;
    }, 0)
  };

  open(domain: string, links: string[]) {
    let totalSpend = Math.abs(this.total(this.trans[domain] || []));
    let exists = links.length > 0;
    this.navCtrl.push(ItemDetailPage, {payload: {domain, links, totalSpend, exists}});
  }

  avatar(short_name: string) {
    return `https://api.adorable.io/avatars/285/${short_name}.png`
  }
}
