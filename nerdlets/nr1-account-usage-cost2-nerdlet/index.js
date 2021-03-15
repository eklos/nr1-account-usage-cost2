import React from 'react';
import PropTypes from 'prop-types';

import { NerdletStateContext, PlatformStateContext, AutoSizer, AccountsQuery, NerdGraphQuery } from "nr1";
import AccountUsage from "./accountUsage";
import 'semantic-ui-css/semantic.min.css';
import jsonSettings from '../../config/settings.json';

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction

export default class Root extends React.Component {
    static propTypes = {
        onChange: PropTypes.func
      };
    
      constructor(props) {
        super(props);
        this.state = {
          isNewRelicUser: true,
          masterAccount: {},
          accounts: [],
          proUserUnitCost: 349.00,
          bytesIngestedUnitCost: 0.25,
          aiIncidentIntelligenceUnitCost: 0.50,
          aiProactiveDetectionUnitCost: 0.25
        };
    
        this.loadAccounts = this.loadAccounts.bind(this);
        //this.switchAccount = this.switchAccount.bind(this);
      }
    
      componentDidMount() {
        //this.getCurrentUser();
        this.loadSettingsFromJson();
        this.loadAccounts();
      }
    
      getCurrentUser() {
        console.log("@@@@ getCurrentUser()... entered");

        //return new Promise(currentUser => {
            const gql = `{ actor { user { email } } }`;
            //console.log('### qgl:', gql);
            NerdGraphQuery.query({ query: gql })
                .then(results => {
                    //console.log("@@@@ current user... email:", results.data.actor.user.email);
                    if (results.data.actor.user.email.toLowerCase().endsWith("@newrelic.com")) {
                      console.log("@@@@ found New Relic user... email:", results.data.actor.user.email);
                      this.setState({ isNewRelicUser: true });
                    }

                }).catch((error) => { 
                    console.log('@@@@ NerdGraphQuery currentUser Error:', error); 
                })
            //return null;
        //})
      }

      loadSettingsFromJson() {
        const parseSettings = async () => {
          var loadSettings = jsonSettings;
          var masterAccount = 0;
          var proUserUnitCost = 349.00;
          var bytesIngestedUnitCost = 0.25;
          var aiIncidentIntelligenceUnitCost = 0.50;
          var aiProactiveDetectionUnitCost = 0.25;
      
          masterAccount = loadSettings.masterAccount;
          proUserUnitCost = loadSettings.proUserUnitCost;
          bytesIngestedUnitCost = loadSettings.bytesIngestedUnitCost;
          aiIncidentIntelligenceUnitCost = loadSettings.aiIncidentIntelligenceUnitCost;
          aiProactiveDetectionUnitCost = loadSettings.aiProactiveDetectionUnitCost;

          this.setState({
            masterAccount: masterAccount,
            proUserUnitCost: proUserUnitCost,
            bytesIngestedUnitCost: bytesIngestedUnitCost,
            aiIncidentIntelligenceUnitCost: aiIncidentIntelligenceUnitCost,
            aiProactiveDetectionUnitCost: aiProactiveDetectionUnitCost  
          });
        };
        parseSettings();

      }

      async loadAccounts() {
        //console.log("calling AccountsQuery in loadAccounts");
        const res = await AccountsQuery.query();
        const data = (res || {}).data;
        if (data.length) {
          this.setState({
            accounts: data
          });
        }
        //console.log("finished AccountsQuery in loadAccounts");
      }
    

    render() {
        const { masterAccount, 
                accounts, 
                isNewRelicUser,
                proUserUnitCost, 
                bytesIngestedUnitCost, 
                aiIncidentIntelligenceUnitCost,
                aiProactiveDetectionUnitCost } = this.state;

        //console.log("masterAccount:", masterAccount);
        //console.log("accounts", accounts);

        return (
            <PlatformStateContext.Consumer>
            {launcherUrlState => (
                <NerdletStateContext.Consumer>
                {nerdletUrlState => (
                    <AutoSizer>
                        {({ width, height }) => (
                            <AccountUsage 
                                launcherUrlState={launcherUrlState}
                                nerdletUrlState={nerdletUrlState}
                                width={width}
                                height={height}
                                masterAccount={masterAccount}
                                accounts={accounts}
                                proUserUnitCost={proUserUnitCost}
                                bytesIngestedUnitCost={bytesIngestedUnitCost}
                                aiIncidentIntelligenceUnitCost={aiIncidentIntelligenceUnitCost}
                                aiProactiveDetectionUnitCost={aiProactiveDetectionUnitCost}  
                                isNewRelicUser={isNewRelicUser}
                            />
                        )}
                    </AutoSizer>
                )}
                </NerdletStateContext.Consumer>
            )}
            </PlatformStateContext.Consumer>
        );
    }
}
