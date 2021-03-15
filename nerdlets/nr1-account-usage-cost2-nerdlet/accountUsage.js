import React from "react";
import PropTypes, { bool } from 'prop-types';

import { Button, Icon, Table } from 'semantic-ui-react';

import { Spinner, PlatformStateContext, NerdletStateContext, AutoSizer, nerdlet, NerdGraphQuery, Grid, GridItem, navigation, Modal, Toast } from 'nr1';

const MONTH_NAMES_FULL = [
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
];

const MONTH_NAMES_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTH_END_DAY = [
    31, // Jan
    28, // Feb
    31, // Mar
    30, // Apr
    31, // May
    30, // Jun
    31, // Jul
    31, // Aug
    30, // Sep
    31, // Oct
    30, // Nov
    31  // Dec
]; 

export default class AccountUsage extends React.Component {
    static propTypes = {
        masterAccount: PropTypes.object,
        accounts: PropTypes.array,
        proUserUnitCost: PropTypes.object, 
        bytesIngestedUnitCost: PropTypes.object,
        aiIncidentIntelligenceUnitCost: PropTypes.object,
        aiProactiveDetectionUnitCost: PropTypes.object,
        isNewRelicUser: PropTypes.bool
    }

    constructor(props) {
        super(props);

        const dateObj = new Date();
        const relativeMonth = dateObj.getMonth();
        const month = MONTH_NAMES_FULL[relativeMonth];
        const day = String(dateObj.getDate()).padStart(2, '0');
        const year = dateObj.getFullYear();
        const output = month  + ' '+ day  + ', ' + year + ' index:'+ dateObj.getMonth();

        this.state = {
            accountsUsages: [],
            usageMonth: this.getUsageMonth(relativeMonth, year),
            usageMonthPrev: '',
            usagePeriod: this.getUsagePeriod(relativeMonth, year), 
            selectedMonth: relativeMonth,
            selectedYear: year,
            isLoading: true,
            loadP1Accounts: 99,
            loadP1Processed: 0,
            loadP1Errors: 0,
            forwardButtonDisabled: true,
            proUserTotalCost: 0,
            proUserTotalCount: 0,
            bytesIngestedTotalCost: 0,
            bytesIngestedTotalGB: 0,
            aiIncidentIntelligenceTotalCost: 0,
            aiIncidentIntelligenceTotalEvents: 0,
            aiProactiveDetectionTotalCost: 0,
            aiProactiveDetectionTotalTrans: 0,
            accountTotalCost: 0,
            sortNameDirection: 'ascending',
            sortIdDirection: 'ascending',
            foundMasterAccount: false,
            invalidMasterAccount: false
        }

        this.isLoaded = this.isLoaded.bind(this);
        this.loadData = this.loadData.bind(this);
        this.getUsersUsage = this.getUsersUsage.bind(this);
        //console.log("%%% usageMonth:", this.state.usageMonth, " usagePeriod:", this.state.usagePeriod);
    }

    getUsageMonth(relativeMonth, year) {        
        var usageMonth = MONTH_NAMES_FULL[relativeMonth] + " " + year;
        return usageMonth;
    }

    getUsagePeriod(relativeMonth, year) {
        const dateObj = new Date();
        var endDay = MONTH_END_DAY[relativeMonth];

        if (relativeMonth == dateObj.getMonth()) {
            endDay = String(dateObj.getDate()).padStart(2, '0');
        }

        var usagePeriod = MONTH_NAMES_SHORT[relativeMonth]  + " 1, " + year + ' - ' +
                          MONTH_NAMES_SHORT[relativeMonth] + " " + endDay + ", " + year;
        return usagePeriod;
    }


    async componentDidMount() {
        await this.loadData();
        
        nerdlet.setConfig({
            timePicker: false,
            timePickerRanges: [
                ...nerdlet.TIME_PICKER_DEFAULT_RANGES,
                nerdlet.TIME_PICKER_RANGE.NONE,
            ]
        });
    }

    async componentDidUpdate(prevProps) {
        var reload = false;

        if (this.state.usageMonth != this.state.usageMonthPrev) {
            reload = true;
        }
 
        if (prevProps.accounts!==this.props.accounts) {
            reload = true;
        }

        if (reload) {
            this.setState({
                accountsUsages: [],
                loadP1Accounts: 99,
                loadP1Processed: 0,
                loadP1Errors: 0,
                usageMonthPrev: this.state.usageMonth
            });
            await this.loadData();
        }
    }

    async loadData() {
        const parseAccounts = () => {
            return new Promise(startPhase2 => {

                this.setState({
                    accountsUsages: []
                });

                this.setState({ loadP1Accounts: this.props.accounts.length });

                for (var  i = 0; i < this.props.accounts.length; i++) {
                    var account = this.props.accounts[i];
                    //console.log("**** loop:", i);
                    
                    this.getUsersUsage(account, this.state.usageMonth)
                    .then((userValues) => {
                        var isError = false;
                        var errorMsg = '';
                        if (userValues != null) {
                            if (userValues.length == 2) {
                                if (userValues[1].errors != null) {
                                    console.log("#$#$# getUsersUsage error occured:", userValues[1].errors[0].message);
                                    isError = true;
                                    errorMsg = userValues[1].errors[0].message;
                                    console.log("#$#$# getUsersUsage error occured for accountId:", userValues[0].id, "message:", errorMsg);
                                    this.setState({loadP1Errors: this.state.loadP1Errors + 1});
                                    console.log("--- getUsersUsage loadP1Processed:", this.state.loadP1Processed, " loadP1Errors", this.state.loadP1Errors, " loadP1Accounts:", this.state.loadP1Accounts);
                                    if ((this.state.loadP1Processed + this.state.loadP1Errors) == this.state.loadP1Accounts) {
                                        //console.log("$$$ lets see if this works...");
                                        
                                        startPhase2();
                                    }
                                }
                            }
                        }
                        if (!isError) {
                            //console.log("%%% usage for accountId:", userValues[0].id, " name:", userValues[0].name, " for:", this.state.usageMonth, " latest.usersBillable:", userValues[1].data.actor.account.nrql.results[0]["latest.usersBillable"]);
                            
                            var proUserUsage = userValues[1].data.actor.account.nrql.results[0]["latest.usersBillable"];
                            //console.log("%%% proUserUsage for accountId:", userValues[0].id, " name:", userValues[0].name, " for:", this.state.usageMonth, " value:", proUserUsage);

                            this.getBytesIngested(userValues[0], this.state.usageMonth)
                            .then((ingestValues) => {
                                //console.log("@@@ ingestValues:", ingestValues);
                                if (ingestValues != null) {
                                    if (ingestValues.length == 2) {
                                        if (ingestValues[1].errors != null) {
                                            console.log("#$#$# getBytesIngested error occured:", ingestValues[1].errors[0].message);
                                            isError = true;
                                            errorMsg = ingestValues[1].errors[0].message;
                                            console.log("#$#$# getBytesIngested error occured for accountId:", ingestValues[0].id, "message:", errorMsg);
                                            this.setState({loadP1Errors: this.state.loadP1Errors + 1});
                                            console.log("--- getBytesIngested loadP1Processed:", this.state.loadP1Processed, " loadP1Errors", this.state.loadP1Errors, " loadP1Accounts:", this.state.loadP1Accounts);
                                            if ((this.state.loadP1Processed + this.state.loadP1Errors) == this.state.loadP1Accounts) {
                                                //console.log("$$$ lets see if this works...");
                                                
                                                startPhase2();
                                            }
                                        }
                                    }
                                }
                                if (!isError) {
                                    //console.log("%%% usage for accountId:", ingestValues[0].id, " name:", ingestValues[0].name, " for:", this.state.usageMonth, " latest.BytesIngested:", ingestValues[1].data.actor.account.nrql.results[0]["latest.BytesIngested"]);
                                    
                                    var bytesIngested = ingestValues[1].data.actor.account.nrql.results[0]["latest.BytesIngested"];
                                    //console.log("%%% bytesIngested for accountId:", ingestValues[0].id, " name:", ingestValues[0].name, " for:", this.state.usageMonth, " value:", bytesIngested);

                                    this.getAiIncidentIntelligence(ingestValues[0], this.state.usageMonth)
                                    .then((incidentValues) => {
                                        //console.log("@@@ incidentValues:", incidentValues);
                                        if (incidentValues != null) {
                                            if (incidentValues.length == 2) {
                                                if (incidentValues[1].errors != null) {
                                                    console.log("#$#$# getAiIncidentIntelligence error occured:", incidentValues[1].errors[0].message);
                                                    isError = true;
                                                    errorMsg = incidentValues[1].errors[0].message;
                                                    console.log("#$#$# getAiIncidentIntelligence error occured for accountId:", incidentValues[0].id, "message:", errorMsg);
                                                    this.setState({loadP1Errors: this.state.loadP1Errors + 1});
                                                    console.log("--- getAiIncidentIntelligence loadP1Processed:", this.state.loadP1Processed, " loadP1Errors", this.state.loadP1Errors, " loadP1Accounts:", this.state.loadP1Accounts);
                                                    if ((this.state.loadP1Processed + this.state.loadP1Errors) == this.state.loadP1Accounts) {
                                                        //console.log("$$$ lets see if this works...");
                                                        
                                                        startPhase2();
                                                    }
                                                }
                                            }
                                        }
                                        if (!isError) {
                                            //console.log("%%% usage for accountId:", ingestValues[0].id, " name:", ingestValues[0].name, " for:", this.state.usageMonth, " latest.IncidentEvents:", ingestValues[1].data.actor.account.nrql.results[0]["latest.IncidentEvents"]);
                                            
                                            var aiIncidentUsage = ingestValues[1].data.actor.account.nrql.results[0]["latest.IncidentEvents"];
                                            //console.log("%%% aiIncidentIntelligenceUsage for accountId:", ingestValues[0].id, " name:", ingestValues[0].name, " for:", this.state.usageMonth, " value:", aiIncidentUsage);

                                            this.getAiProactiveDetection(ingestValues[0], this.state.usageMonth)
                                            .then((detectionValues) => {
                                                //console.log("@@@ detectionValues:", detectionValues);
                                                if (detectionValues != null) {
                                                    if (detectionValues.length == 2) {
                                                        if (detectionValues[1].errors != null) {
                                                            console.log("#$#$# getAiProactiveDetection error occured:", detectionValues[1].errors[0].message);
                                                            isError = true;
                                                            errorMsg = detectionValues[1].errors[0].message;
                                                            console.log("#$#$# getAiProactiveDetection error occured for accountId:", detectionValues[0].id, "message:", errorMsg);
                                                            this.setState({loadP1Errors: this.state.loadP1Errors + 1});
                                                            console.log("--- getAiProactiveDetection loadP1Processed:", this.state.loadP1Processed, " loadP1Errors", this.state.loadP1Errors, " loadP1Accounts:", this.state.loadP1Accounts);
                                                            if ((this.state.loadP1Processed + this.state.loadP1Errors) == this.state.loadP1Accounts) {
                                                                //console.log("$$$ lets see if this works...");
                                                                
                                                                startPhase2();
                                                            }
                                                       }
                                                    }
                                                }
                                                if (!isError) {
                                                    //console.log("%%% usage for accountId:", detectionValues[0].id, " name:", detectionValues[0].name, " for:", this.state.usageMonth, " latest.IncidentEvents:", detectionValues[1].data.actor.account.nrql.results[0]["latest.IncidentEvents"]);
                                                    
                                                    var aiAppTransactionsAnalyzed = detectionValues[1].data.actor.account.nrql.results[0]["latest.AppTransactionsAnalyzed"];
                                                    //console.log("%%% aiProactiveDetectionUsage for accountId:", detectionValues[0].id, " name:", detectionValues[0].name, " for:", this.state.usageMonth, " value:", aiAppTransactionsAnalyzed);
                                                    
                                                    var isMasterAccount = false;
                                                    var accountName = detectionValues[0].name;
                                                    if (detectionValues[0].id == this.props.masterAccount) {
                                                        isMasterAccount = true;
                                                        accountName = accountName + " (master)";
                                                        this.setState({ foundMasterAccount: true });
                                                    }
                                                    var accountUsage = {
                                                        id: detectionValues[0].id,
                                                        name: accountName, //detectionValues[0].name,
                                                        isMasterAccount: isMasterAccount,
                                                        proUserUsage: proUserUsage,
                                                        proUserCost: 0,
                                                        bytesIngested: bytesIngested,
                                                        bytesIngestedBillableInGB: 0,
                                                        bytesIngestedCost: 0.00,
                                                        aiIncidentIntelligenceEvents: aiIncidentUsage,
                                                        aiIncidentIntelligenceBillableEvents: 0,
                                                        aiIncidentIntelligenceCost: 0.00,
                                                        aiProactiveDetectionTrans: aiAppTransactionsAnalyzed,
                                                        aiProactiveDetectionBillableTrans: 0,
                                                        aiProactiveDetectionCost: 0.00,
                                                        accountTotalCost: 0.00
                                                    }
            
                                                    //console.log("*** accountId:", detectionValues[0].id, 
                                                    //            "proUserUsage", proUserUsage, 
                                                    //            "bytesIngested", bytesIngested,  
                                                    //            "aiIncidentUsage", aiIncidentUsage, 
                                                    //            "aiAppTransactionsAnalyzed", aiAppTransactionsAnalyzed);

                                                    this.setState({
                                                        accountsUsages: this.state.accountsUsages.concat(accountUsage),
                                                        loadP1Processed: this.state.loadP1Processed + 1
                                                    });
                                                    //console.log("--- loadP1Processed:", this.state.loadP1Processed, " loadP1Errors", this.state.loadP1Errors, " loadP1Accounts:", this.state.loadP1Accounts);
                                                    if ((this.state.loadP1Processed + this.state.loadP1Errors) == this.state.loadP1Accounts) {
                                                        //console.log("$$$ lets see if this works...");
                                                        
                                                        startPhase2();
                                                    }
                                                }
            
                                            })
                                        }
            
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }

        this.setState({isLoading: true});

        if (this.props.accounts.length > 0) {
            //console.log("Calling parseAccounts");
            parseAccounts()
            .then(() => {
                //console.log("$$$ loadP1Processed:", this.state.loadP1Processed, " loadP1Errors", this.state.loadP1Errors, " loadP1Accounts:", this.state.loadP1Accounts);
                if (!this.state.foundMasterAccount) {
                    this.setState({ invalidMasterAccount: true });
                }
                this.costUserUsage();
                this.costBytesIngested();
                this.costAiIncidentIntelligence();
                this.costAiProactiveDetection();

                this.totalEachAccounts();

                const sortedAccountsUsages = this.sortAccounts(this.state.accountsUsages, 'name', 'ascending');

                this.setState({
                    accountsUsages: sortedAccountsUsages,
                    isLoading: false
                });
            })
            //console.log("Finished parseAccounts.... accountUsages:", this.state.accountsUsages);
        }
    }

    changeSort(columnName) {
        console.log("### changeSort:", columnName);

        var direction = '';
        if (columnName == 'name') {
            direction = this.state.sortNameDirection;
        }
        else if (columnName ==  'id') {
            direction = this.state.sortIdDirection;
        }
        else {
            return;
        }

        if (direction == 'ascending') {
            direction = 'descending';
        }
        else {
            direction = 'ascending';
        }

        const sortedAccountsUsages = this.sortAccounts(this.state.accountsUsages, columnName, direction);

        if (columnName == 'name') {
            this.setState({ sortNameDirection: direction });
        }
        else if (columnName == 'id') {
            this.setState({ sortIdDirection: direction });
        }
        this.setState({ accountsUsages: sortedAccountsUsages });
    }

    sortAccounts(accountsUsages, columnName, direction) {
        const sortedAccountsUsages = accountsUsages.sort(function(a,b) {
            var columnA;
            var columnB;
            if (columnName == 'name') {
                columnA = a.name.toUpperCase(); // ignore upper and lowercase
                columnB = b.name.toUpperCase(); // ignore upper and lowercase
            }
            else if (columnName == 'id') {
                columnA = a.id;
                columnB = b.id;
            }
            else {
                columnA = 0;
                columnB = 0;
            }
            
            if (direction == 'ascending') {
                if (columnA < columnB) {
                    return -1; //columnA comes first
                  }
                  if (columnA > columnB) {
                    return 1; // columnB comes first
                  }
                  return 0;  // names must be equal
            }
            else {  // descending mode
                if (columnA > columnB) {
                    return -1; //columnB comes first
                  }
                  if (columnA < columnB) {
                    return 1; // columnA comes first
                  }
                  return 0;  // names must be equal
  
            }
          
        });
        return sortedAccountsUsages;

    }

    periodButtonEvent(direction) {
        //console.log("*** ", direction, " button clicked");

        var month = this.state.selectedMonth;
        var monthPrev = this.state.month;
        var year = this.state.selectedYear;

        if (direction == "LEFT") {
            if (month == 0) {  // are we going back 1 month from January?
                month = 11;         // Set month to December
                year = year - 1;    // Set year back by one
            }
            else {
                month = month - 1;
            }
        }
        else {
            if (month == 11) {  // are we going forward 1 month from December?
                month = 0;          // Set month to January
                year = year + 1;    // Set year back by one
            }
            else {
                month = month + 1;
            }
        }
        var usageMonth = this.getUsageMonth(month, year);
        var usagePeriod = this.getUsagePeriod(month, year);

        var forwardButtonDisabled = false;
        const dateObj = new Date();
        if (month == dateObj.getMonth() && year == dateObj.getFullYear()) {
            forwardButtonDisabled = true;
        }

        this.setState({ 
            selectedMonth: month,
            selectedYear: year,
            usageMonth: usageMonth,
            usagePeriod: usagePeriod,
            usageMonthPrev: monthPrev,
            forwardButtonDisabled: forwardButtonDisabled,
            sortNameDirection: 'ascending',
            sortIdDirection: 'ascending'
         });
    }

    costUserUsage() {
        var proUserTotalCost = 0;
        var proUserTotalCount = 0;

        for (var  i = 0; i < this.state.accountsUsages.length; i++) {
            var account = this.state.accountsUsages[i];
            if (account.isMasterAccount) {
                account.proUserCost = account.proUserUsage * this.props.proUserUnitCost;
                proUserTotalCost = proUserTotalCost + account.proUserCost;
                proUserTotalCount = proUserTotalCount + account.proUserUsage;
            }
        }
        this.setState({ 
            proUserTotalCost: proUserTotalCost,
            proUserTotalCount: proUserTotalCount
        });

        //console.log("$$$ proUserTotalCost:", proUserTotalCost.toFixed(2));
    }

    costBytesIngested() {
        var totalBytesIngestedGB = 0;
        var totalBytesIngestedCost = 0;
        var masterAccount = null;

        for (var  i = 0; i < this.state.accountsUsages.length; i++) {
            var account = this.state.accountsUsages[i];
            if (!account.isMasterAccount) {
                if (account.bytesIngested != null) {
                    var bytesInGB = Math.floor(account.bytesIngested / 1000000000) - 100;
                    if (bytesInGB > 0) {
                        totalBytesIngestedGB = totalBytesIngestedGB + bytesInGB;
                        account.bytesIngestedBillableInGB = bytesInGB;
                        account.bytesIngestedCost = (account.bytesIngestedBillableInGB * this.props.bytesIngestedUnitCost);
                        totalBytesIngestedCost = totalBytesIngestedCost + account.bytesIngestedCost;
                    }
                }
            }
            else {
                masterAccount = account;
            }
        }
        var bytesInGB = 0;
        if (masterAccount != null) {
            bytesInGB = Math.floor(masterAccount.bytesIngested / 1000000000) - 100;

            if (bytesInGB > totalBytesIngestedGB) {
                masterAccount.bytesIngestedBillableInGB = (bytesInGB - totalBytesIngestedGB); 
                masterAccount.bytesIngestedCost = (masterAccount.bytesIngestedBillableInGB * this.props.bytesIngestedUnitCost);
                totalBytesIngestedCost = totalBytesIngestedCost + masterAccount.bytesIngestedCost;
                totalBytesIngestedGB = totalBytesIngestedGB + masterAccount.bytesIngestedBillableInGB;
             }
        }

        this.setState({ 
            bytesIngestedTotalCost: totalBytesIngestedCost,
            bytesIngestedTotalGB: totalBytesIngestedGB
         });

        //console.log("$$$ totalBytesIngestedGB:", totalBytesIngestedGB, 
        //            " totalBytesIngestedCost:", totalBytesIngestedCost.toFixed(2));
    }
    
    costAiIncidentIntelligence() {
        var totalEvents = 0;
        var totalEventsCost = 0;
        var masterAccount = null;

        for (var  i = 0; i < this.state.accountsUsages.length; i++) {
            var account = this.state.accountsUsages[i];
            if (!account.isMasterAccount) {
                if (account.aiIncidentIntelligenceEvents != null) {
                    var events = Math.floor(account.aiIncidentIntelligenceEvents) - 1000;
                    if (events > 0) {
                        totalEvents = totalEvents + events;
                        account.aiIncidentIntelligenceBillableEvents = events;
                        account.aiIncidentIntelligenceCost = (account.aiIncidentIntelligenceBillableEvents * this.props.aiIncidentIntelligenceUnitCost);
                        totalEventsCost = totalEventsCost + account.aiIncidentIntelligenceCost;
                    }
                }
            }
            else {
                masterAccount = account;
            }
        }
        var events = 0;
        if (masterAccount != null) {
            events = Math.floor(masterAccount.aiIncidentIntelligenceEvents) - 1000;

            if (events > totalEvents) {
                masterAccount.aiIncidentIntelligenceBillableEvents = (events - totalEvents); 
                masterAccount.aiIncidentIntelligenceCost = (masterAccount.aiIncidentIntelligenceBillableEvents * this.props.aiIncidentIntelligenceUnitCost);
                totalEventsCost = totalEventsCost + masterAccount.aiIncidentIntelligenceCost;
            }
        }

        this.setState({ 
            aiIncidentIntelligenceTotalCost: totalEventsCost,
            aiIncidentIntelligenceTotalEvents: totalEvents
         });

        
        //console.log("$$$ totalAiIncidentIntelligenceEvents", (totalEvents + masterAccount.aiIncidentIntelligenceBillableEvents), 
        //            " totalEventsCost:", totalEventsCost.toFixed(2));
    }

    costAiProactiveDetection() {
        var totalTransInMillions = 0;
        var totalTransCost = 0;
        var masterAccount = null;
                
        // If selected date < March 2021, then include ai proactive detection
        var includeAiProactiveDetection = false;
        if (this.state.selectedYear < 2021) {
            includeAiProactiveDetection = true;
        }
        else if (this.state.selectedMonth < 2 &&  // less than March 2021
                 this.state.selectedYear == 2021) {
            includeAiProactiveDetection = true;
        }

        if (includeAiProactiveDetection) {
            for (var  i = 0; i < this.state.accountsUsages.length; i++) {
                var account = this.state.accountsUsages[i];
                if (!account.isMasterAccount) {
                    if (account.aiProactiveDetectionTrans != null) {
                        var transInMillions = Math.floor(account.aiProactiveDetectionTrans / 1000000) - 100;
                        if (transInMillions > 0) {
                            totalTransInMillions = totalTransInMillions + transInMillions;
                            account.aiProactiveDetectionBillableTrans = transInMillions;
                            account.aiProactiveDetectionCost = (account.aiProactiveDetectionBillableTrans * this.props.aiProactiveDetectionUnitCost);
                            totalTransCost = totalTransCost + account.aiProactiveDetectionCost;
                        }
                    }
                }
                else {
                    masterAccount = account;
                }
            }
            if (masterAccount != null) {
                var transInMillions = 0;
                transInMillions = Math.floor(masterAccount.aiProactiveDetectionTrans / 1000000) - 100;
        
                if (transInMillions > totalTransInMillions) {
                masterAccount.aiProactiveDetectionBillableTrans = (transInMillions - totalTransInMillions); 
                masterAccount.aiProactiveDetectionCost = (masterAccount.aiProactiveDetectionBillableTrans * this.props.aiProactiveDetectionUnitCost);
                totalTransCost = totalTransCost + masterAccount.aiProactiveDetectionCost;
                }
            }
        }
        if (masterAccount != null) {
            totalTransInMillions = totalTransInMillions + masterAccount.aiProactiveDetectionBillableTrans;
        }

        this.setState({ 
            aiProactiveDetectionTotalCost: totalTransCost,
            aiProactiveDetectionTotalTrans: totalTransInMillions
         });

        //console.log("$$$ totalAiProactiveDetectionTransInMillions:", (totalTransInMillions + masterAccount.aiProactiveDetectionBillableTrans), 
        //            " totalTransCost:", totalTransCost.toFixed(2));
    }

    totalEachAccounts() {
        var totalAccountCost = 0;
        for (var  i = 0; i < this.state.accountsUsages.length; i++) {
            var account = this.state.accountsUsages[i];
            account.accountTotalCost = account.proUserCost + account.bytesIngestedCost + account.aiIncidentIntelligenceCost + account.aiProactiveDetectionCost;
            totalAccountCost = totalAccountCost + account.accountTotalCost;
        }

        this.setState({ accountTotalCost: totalAccountCost });

        //console.log("$$$ accountTotalCost:", totalAccountCost.toFixed(2));
    }

    getUsersUsage(account, month) {
        return new Promise(resolveUsers => {
            const usageMonth = `'${month}'`;
            const gql = `{ actor { account(id: ${account.id}) { nrql(query: "select latest(usersBillable) from NrMTDConsumption WHERE monthOf(timestamp) = ${usageMonth} since 12 months ago") { results } } } }`;

            NerdGraphQuery.query({ query: gql })
                .then(results => {
                    //console.log("users for accountId:", account.id, " for:", usageMonth, " results:", results);

                    resolveUsers([account, results]);

                }).catch((error) => { 
                    console.log('NerdGraphQuery getUsersUsage Error:', error, ' Query:', qpl); 
                    resolveUsers([account, error]);
                })
        })
    }

    getBytesIngested(account, month) {
        return new Promise(resolveIngest => {
            const usageMonth = `'${month}'`;
            const gql = `{ actor { account(id: ${account.id}) { nrql(query: "select latest(BytesIngested) from NrMTDConsumption WHERE monthOf(timestamp) = ${usageMonth} since 12 months ago") { results } } } }`;

            NerdGraphQuery.query({ query: gql })
                .then(results => {
                    //console.log("ingest for accountId:", account.id, " for:", usageMonth, " results:", results);

                    resolveIngest([account, results]);

                }).catch((error) => { 
                    console.log('NerdGraphQuery getBytesIngested Error:', error); 
                    resolveIngest([account, error]);
                })
        })
    }

    getAiIncidentIntelligence(account, month) {
        return new Promise(resolveAiIncidents => {
            const usageMonth = `'${month}'`;
            const gql = `{ actor { account(id: ${account.id}) { nrql(query: "select latest(IncidentEvents) from NrMTDConsumption WHERE monthOf(timestamp) = ${usageMonth} since 12 months ago") { results } } } }`;

            NerdGraphQuery.query({ query: gql })
                .then(results => {
                    //console.log("aiIncidents for accountId:", account.id, " for:", usageMonth, " results:", results);

                    resolveAiIncidents([account, results]);

                }).catch((error) => { 
                    console.log('NerdGraphQuery getAiIncidentIntelligence Error:', error); 
                    resolveAiIncidents([account, error]);
                })
        })
    }

    getAiProactiveDetection(account, month) {
        return new Promise(resolveAiDetections => {
            const usageMonth = `'${month}'`;
            const gql = `{ actor { account(id: ${account.id}) { nrql(query: "select latest(AppTransactionsAnalyzed) from NrMTDConsumption WHERE monthOf(timestamp) = ${usageMonth} since 12 months ago") { results } } } }`;

            NerdGraphQuery.query({ query: gql })
                .then(results => {
                    //console.log("aiIncidents for accountId:", account.id, " for:", usageMonth, " results:", results);

                    resolveAiDetections([account, results]);

                }).catch((error) => { 
                    console.log('NerdGraphQuery getAiProactiveDetection Error:', error); 
                    resolveAiDetections([account, error]);
                })
        })
    }

    isLoaded() {
        if (this.state.isLoading == true) {
            return false;
        }
        else {
            return true;
        }
    }

    formatMoney(number, decPlaces, decSep, thouSep) {
        decPlaces = isNaN(decPlaces = Math.abs(decPlaces)) ? 2 : decPlaces,
        decSep = typeof decSep === "undefined" ? "." : decSep;
        thouSep = typeof thouSep === "undefined" ? "," : thouSep;
        var sign = number < 0 ? "-" : "";
        var i = String(parseInt(number = Math.abs(Number(number) || 0).toFixed(decPlaces)));
        var j = (j = i.length) > 3 ? j % 3 : 0;
        
        return sign +
            (j ? i.substr(0, j) + thouSep : "") +
            i.substr(j).replace(/(\decSep{3})(?=\decSep)/g, "$1" + thouSep) +
            (decPlaces ? decSep + Math.abs(number - i).toFixed(decPlaces).slice(2) : "");
        }

    render() {
        const button = true;
        const accounts = this.state.accountsUsages;
        //console.log("@@@@@ masterAccount:", this.props.masterAccount);
        //console.log("@@@@@ allAccounts", this.props.accounts);
        //console.log("@@@@@ isNewRelicUser:", this.props.isNewRelicUser);

        //console.log("@@@ accountUsages:", this.state.accountsUsages);
        //console.log("@@@ accountUsages:", accounts);

        if (this.state.isLoading)
        {
            return <Spinner fillContainer />;
        }
        else if (this.state.invalidMasterAccount) {
            Toast.showToast({
              title: 'Master account not found',
              description: 'Nerdpack not configured correctly - see documentation',
              type: Toast.TYPE.CRITICAL,
            });
        }
        else {
            //console.log("@@@ accountUsages:", this.state.accountsUsages);
            return (
                <PlatformStateContext.Consumer>
                    {launcherUrlState => (
                        <NerdletStateContext.Consumer>
                            {nerdletUrlState => (
                                <AutoSizer>
                                    {({ width, height }) => (
                                        <div>
                                            <h1>New Relic ONE - Pro Account Usage Cost</h1>
                                            <Grid>
                                                <GridItem columnStart={1} columnEnd={2} colSpan={2} style={{width: '100%'}}>
                                                    <Button basic compact circular icon='arrow alternate circle left outline' onClick={() => { this.periodButtonEvent('LEFT'); }}  />
                                                        {this.state.usagePeriod}
                                                    <Button basic compact circular icon='arrow alternate circle right outline' onClick={() => { this.periodButtonEvent('RIGHT'); }} disabled={this.state.forwardButtonDisabled} />
                                                </GridItem>

                                            </Grid>

                                            <Table celled sortable>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.HeaderCell sorted={this.state.sortNameDirection} onClick={() => this.changeSort('name')} >Account Name</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right' sorted={this.state.sortIdDirection} onClick={() => this.changeSort('id')} >Account Id</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right'>Pro User Cost</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right'>Pro User Count</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right'>Data Ingest Cost</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right'>Billable Data Ingest In GB</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right'>AI Incident Intelligence Cost</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right'>AI Incident Intelligence Events</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right'>AI Proactive Detection Cost</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right'>AI Proactive Detection Million Trans</Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right'>Sub Account Total Cost</Table.HeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {
                                                        accounts.map((account, i) => {
                                                            return (
                                                                <Table.Row key={i}>
                                                                    <Table.Cell style={{fontWeight: "bold"}}>{account.name}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{account.id}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{this.formatMoney(account.proUserCost, 2, '.', ',')}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{this.formatMoney(account.proUserUsage, 0, '.', ',')}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{this.formatMoney(account.bytesIngestedCost, 2, '.', ',')}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{this.formatMoney(account.bytesIngestedBillableInGB, 0, '.', ',')}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{this.formatMoney(account.aiIncidentIntelligenceCost, 2, '.', ',')}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{this.formatMoney(account.aiIncidentIntelligenceBillableEvents, 0, '.', ',')}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{this.formatMoney(account.aiProactiveDetectionCost, 2, '.', ',')}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{this.formatMoney(account.aiProactiveDetectionBillableTrans, 0, '.', ',')}</Table.Cell>
                                                                    <Table.Cell textAlign='right'>{this.formatMoney(account.accountTotalCost, 2, '.', ',')}</Table.Cell>
                                                                </Table.Row>
                                                            )
                                                        })
                                                    }
                                                </Table.Body>
                                                <Table.Footer fullWidth>
                                                    <Table.Row>
                                                        <Table.HeaderCell colSpan='2'/>
                                                        <Table.HeaderCell textAlign='right' style={{fontWeight: "bold", fontSize: "large"}}>
                                                            {this.formatMoney(this.state.proUserTotalCost, 2, '.', ',')}
                                                        </Table.HeaderCell> 
                                                        <Table.HeaderCell textAlign='right' style={{fontWeight: "bold", fontSize: "large"}}>
                                                            {this.formatMoney(this.state.proUserTotalCount, 0, '.', ',')}
                                                        </Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right' style={{fontWeight: "bold", fontSize: "large"}}>
                                                            {this.formatMoney(this.state.bytesIngestedTotalCost, 2, '.', ',')}
                                                        </Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right' style={{fontWeight: "bold", fontSize: "large"}}>
                                                            {this.formatMoney(this.state.bytesIngestedTotalGB, 0, '.', ',')}
                                                        </Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right' style={{fontWeight: "bold", fontSize: "large"}}>
                                                            {this.formatMoney(this.state.aiIncidentIntelligenceTotalCost, 2, '.', ',')}
                                                        </Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right' style={{fontWeight: "bold", fontSize: "large"}}>
                                                            {this.formatMoney(this.state.aiIncidentIntelligenceTotalEvents, 0, '.', ',')}
                                                        </Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right' style={{fontWeight: "bold", fontSize: "large"}}>
                                                            {this.formatMoney(this.state.aiProactiveDetectionTotalCost, 2, '.', ',')}
                                                        </Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right' style={{fontWeight: "bold", fontSize: "large"}}>
                                                            {this.formatMoney(this.state.aiProactiveDetectionTotalTrans, 0, '.', ',')}
                                                        </Table.HeaderCell>
                                                        <Table.HeaderCell textAlign='right' style={{fontWeight: "bold", fontSize: "x-large"}}>
                                                            {this.formatMoney(this.state.accountTotalCost, 2, '.', ',')}
                                                        </Table.HeaderCell>
                                                    </Table.Row>
                                                </Table.Footer>
                                            </Table>

                                        </div>                                    
                                    )}
                                </AutoSizer>
                            )}
                        </NerdletStateContext.Consumer>
                    )}
             </PlatformStateContext.Consumer>
            )
        }
    }

}
