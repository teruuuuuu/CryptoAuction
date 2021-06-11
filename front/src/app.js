import React from "react";
import * as ReactDOM from "react-dom";
import './style.less';

const cryptoAuctionABI = require('../../build/contracts/Auction.json');
const Web3 = require('web3');


let web3js;

let syncAccountTimer;
let eventLogTimer;
let tailTimer;
let logBox = [];
let contracts = [];

export class App extends React.Component {
    constructor(props) {
        super(props);
        this.props = props;
        this.state = {
            mode: 1,
            account: undefined,
            title: "",
            text: "",
            time: 0,
            price: 0.0001,
            eventLog: "",
            contractAddress: ['---'],
            addressSelectedIndex: 0,
            beneficiary: "",
            highestBidder: "",
            bidPrice: 0.0001,
            end: false
        };
        web3js = props.metamaskInstalled ? new Web3(web3.currentProvider) : undefined;
        this.init();
    }

    init() {
        const syncAccount = () => {
            if (syncAccountTimer) {
                clearInterval(syncAccountTimer);
            }
            syncAccountTimer = setInterval(() => {
                ethereum.request({ method: 'eth_requestAccounts' }).then(accounts => {
                    const { account } = this.state;
                    if (account != accounts[0]) {
                        this.set({ account: accounts[0] });
                    }

                });
            }, 1000);
        }
        const readEventLog = () => {
            if (eventLogTimer) {
                clearInterval(eventLogTimer);
            }
            eventLogTimer = setInterval(() => {
                if (logBox.length > 0) {
                    if (logBox[0].length > 0) {
                        this.addEventLog(logBox[0].slice(0, 1))
                        logBox[0] = logBox[0].slice(1)
                    } else {
                        this.addEventLog('\n')
                        logBox.shift()
                    }

                }
            }, 10);
        }
        const tailEventLog = () => {
            if (tailTimer) {
                clearInterval(tailTimer);
            }
            tailTimer = setInterval(() => {
                this.tail()
            }, 1000);
        }
        syncAccount();
        readEventLog();
        tailEventLog();
    }


    selling() {
        const { title, text, time, price, account } = this.state;
        if (!account) {
            alert("アカウントが不明です")
        } else if (title.trim().length == 0 || text.trim().length == 0 || time < 0 || price < 0) {
            alert("入力が無効です")
        } else {
            const contract = new web3js.eth.Contract(cryptoAuctionABI.abi);
            logBox.push("create contract.");
            contract.deploy({ data: cryptoAuctionABI.bytecode, arguments: [title, text, time, web3js.utils.toWei(price.toString(), "ether"), account] })
                .send({
                    from: this.state.account,
                    gasPrice: 20000000000
                }, (error, transactionHash) => { })
                .on('error', (error) => { })
                .on('transactionHash', (transactionHash) => { })
                .on('receipt', (receipt) => {
                    // logBox.push("receipt: " + receipt.contractAddress);
                    // console.log(receipt.contractAddress) // contains the new contract address
                })
                .on('confirmation', (confirmationNumber, receipt) => { })
                .then((newContractInstance) => {
                    logBox.push(`create contract success: address[${newContractInstance.options.address}]`);
                    console.log(newContractInstance.options.address) // instance with the new contract address
                    this.set({ contractAddress: this.state.contractAddress.concat(newContractInstance.options.address) });
                });

            this.set(this.genSellingState());
        }
    }

    changeMode(mode) {
        this.set(Object.assign(this.genSellingState(), { mode: mode }));
    }

    changeAddress(index) {
        const { contractAddress } = this.state;
        if (index != 0) {
            const currentAddress = contractAddress[index];
            if (!contracts[currentAddress]) {
                contracts[currentAddress] = new web3js.eth.Contract(cryptoAuctionABI.abi, currentAddress);
                this.listen(contracts[currentAddress])
            }
            this.getInfo(contracts[currentAddress])

        }
        this.set(Object.assign(this.genSellingState(), { addressSelectedIndex: index }));
    }

    listen(contract) {
        contract.events.allEvents({ filter: {} })
            .on("data", (event) => {
                if (event.event == "HighestBidIncreased") {
                    logBox.push(`入札: アカウント[${event.returnValues.bidder}] bid[${Web3.utils.fromWei(event.returnValues.amount, 'ether')}]`)
                } else {
                    logBox.push(`終了: アカウント[${event.returnValues.winner}] bid[${Web3.utils.fromWei(event.returnValues.amount, 'ether')}]`)
                }

                console.info(event.returnValues);
                this.getInfo(contract)
            }).on("error", console.error);
    }

    getInfo(contract) {
        logBox.push("send auction info request.");
        contract.methods.getInfo().call().then(info => {
            console.info(info);
            logBox.push(`get auction info: title[${info[0]}] text[${info[1]}] auctionEndTime[${new Date(1000 * info[2])}] beneficiary[${info[3]}] highestBidder[${info[4]}] highestBid[${info[5]}] end[${info[6]}]`)

            const title = info[0];
            const text = info[1];
            const time = (new Date(1000 * info[2]) - new Date()) / (1000 * 60);
            const price = Web3.utils.fromWei(info[5], 'ether');
            const beneficiary = info[3]
            const highestBidder = info[4]
            const end = info[6]
            this.set({ title: title, text: text, time: time, price: price, beneficiary: beneficiary, highestBidder: highestBidder, end: end });
        });
    }

    bidding() {
        const { account, contractAddress, addressSelectedIndex, bidPrice } = this.state;
        if (!account) {
            alert("アカウントが不明です")
        } else if (addressSelectedIndex == 0) {
            alert("コントラクトアドレスを選択してください")
        } else {
            const currentAddress = contractAddress[addressSelectedIndex];
            const contract = contracts[currentAddress];
            logBox.push("send auction info request.");
            contract.methods.bid().send({ from: account, value: web3js.utils.toWei(bidPrice, "ether") })
                .on("receipt", (result) => {
                    console.info(result);
                })
                .on("error", (error) => {
                    console.error(error);
                });
        }
    }

    auctionEnd() {
        const { account, contractAddress, addressSelectedIndex } = this.state;
        if (!account) {
            alert("アカウントが不明です")
        } else if (addressSelectedIndex == 0) {
            alert("コントラクトアドレスを選択してください")
        } else {
            const currentAddress = contractAddress[addressSelectedIndex];
            const contract = contracts[currentAddress];
            logBox.push("send auction end request.");
            contract.methods.auctionEnd().send({ from: account, value: 0 })
                .on("receipt", (result) => {
                    console.info(result);
                })
                .on("error", (error) => {
                    console.error(error);
                });
        }
    }

    render() {
        const { metamaskInstalled } = this.props;
        const metamaskMessage = () => <div>Handle the case where the user doesn't have Metamask installed.<br />Probably show them a message prompting them to install Metamask.</div>
        return (
            metamaskInstalled ? this.appRender() : metamaskMessage()
        );
    }

    appRender() {
        const { account, mode } = this.state;
        return (<div className="appArea">
            <div className="contentsArea">
                <div className="account">account: {account}</div>
                <div className="box">
                    <div className="header">
                        <div className={mode == 1 ? "mode on" : "mode"} onClick={() => this.changeMode(1)} >出品</div>
                        <div className={mode == 2 ? "mode on" : "mode"} onClick={() => this.changeMode(2)}>入札</div>
                    </div>
                    {mode == 1 ? this.sellingRender() : this.biddingRender()}
                </div>
            </div>
            {this.eventLogRender()}
        </div>)
    }

    sellingRender() {
        const { title, text, time, price } = this.state;
        return <div className="sellingArea">
            <div className="sellingForm">
                <div className="label">名前: </div><input className="input" type="text" value={title} onChange={e => this.set({ title: e.target.value })} />
                <div className="label">説明: </div><textarea className="textArea" value={text} onChange={e => this.set({ text: e.target.value })} />
                <div className="label">出品時間(分): </div><input className="input" type="number" value={time} onChange={e => this.set({ time: e.target.value })} />
                <div className="label">始値(eth): </div><input className="input" type="text" value={price} onChange={e => this.set({ price: e.target.value })} />
                <div></div><button className="button" onClick={() => this.selling()}>出品</button>
            </div>
        </div>
    }

    biddingRender() {
        const { account, title, text, time, price, contractAddress, addressSelectedIndex, bidPrice, beneficiary, highestBidder, end } = this.state;
        return <div className="biddingArea">
            <div className="address">
                <div>コントラクトアドレス:</div><select name="selectContract" value={addressSelectedIndex} onChange={e => this.changeAddress(e.target.value)}>{contractAddress.map((address, index) => <option value={index} key={index} >{address}</option>)}</select>
            </div>
            <div className="sellingForm">
                <div className="label">名前: </div><input className="input" type="text" value={title} readOnly />
                <div className="label">説明: </div><textarea className="textArea" value={text} readOnly />
                <div className="label">残り時間(分): </div><input className="input" type="number" value={time} readOnly />
                <div className="label">出品者: </div><input className="input" type="text" value={beneficiary} readOnly />
                <div className="label">入札者: </div><input className="input" type="text" value={highestBidder} readOnly />
                <div className="label">値段(eth): </div><input className="input" type="number" value={price} readOnly />
                <div className="label">終了: </div><input className="input" type="text" value={end} readOnly />
            </div>
            <div className="biddingForm">
                <input type="number" value={bidPrice} onChange={e => this.set({ bidPrice: e.target.value })}></input><button onClick={() => this.bidding()} disabled={addressSelectedIndex == 0}>入札</button>
            </div>
            <div className="endForm">
                <button onClick={() => this.auctionEnd()} disabled={beneficiary.toLowerCase() != account.toLocaleLowerCase()}>終了</button>
            </div>
        </div>
    }

    eventLogRender() {
        const { eventLog } = this.state;
        return <div className="eventLogArea">
            <textarea className="logText" readOnly value={eventLog} onScroll={() => this.tail()}></textarea>
        </div>
    }

    set(state) {
        this.setState(Object.assign({}, this.state, state))
    }
    genSellingState() {
        return { title: "", text: "", time: 0, beneficiary: "", highestBidder: "", price: 0.001, end: false }
    }
    addEventLog(log) {
        this.set(Object.assign({}, this.state, { eventLog: this.state.eventLog + log }))
    }

    tail() {
        const fileScroll = ReactDOM.findDOMNode(this).getElementsByClassName(
            "logText"
        )[0];
        fileScroll.scrollTop = fileScroll.scrollHeight;
    }
}