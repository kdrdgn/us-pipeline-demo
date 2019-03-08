import React, { Component } from 'react';
import './App.css';

class App extends Component {
  constructor(props) {
    super(props);
    this.emptyForm = {
      month: '',
      volume: '',
      pipeline: '',
      counterparty: '',
    };

    this.counterParties = [
      {
        id: 'CPA',
        name: 'Counterparty A',
      },
      {
        id: 'CPB',
        name: 'Counterparty B',
      },
      {
        id: 'CPC',
        name: 'Counterparty C',
      },
      {
        id: 'CPD',
        name: 'Counterparty D',
      },
    ];

    this.pipelines = [
      {
        id: 'keystone-transcanada',
        name: 'Keystone (TransCanada)',
        source: 0,
        target: 1,
      },
      {
        id: 'marketlink-transcanada',
        name: 'MarketLink (TransCanada)',
        source: 1,
        target: 2,
      },
      {
        id: 'seaway-1',
        name: 'Seaway 1',
        source: 1,
        target: 3,
      },
      {
        id: 'seaway-2',
        name: 'Seaway 2',
        source: 3,
        target: 4,
      },
      {
        id: 'seaway-3',
        name: 'Seaway 3',
        source: 3,
        target: 5,
      },
    ];

    this.state = {
      tab: 'shipper',
      ctab: 'terminal',
      shipper: 'CPA',
      isEditing: false,
      trades: [],
      operatorPipelines: {},
      configs: {
        toggleFlow: false,
      },
      form: {
        ...this.emptyForm,
      },
      terminals: [
        {
          id: 0,
          name: 'Patoka',
          totalCapacity: 200,
          color: '#0074D9',
        },
        {
          id: 1,
          name: 'Cushing-Oklahoma',
          totalCapacity: 200,
          color: '#85144b',
        },
        {
          id: 2,
          name: 'Nederland-TX',
          totalCapacity: 200,
          color: '#39CCCC',
        },
        {
          id: 3,
          name: 'Enterprise-Jones-Creek',
          totalCapacity: 200,
          color: '#B10DC9',
        },
        {
          id: 4,
          name: 'Echo',
          totalCapacity: 200,
          color: '#001f3f',
        },
        {
          id: 5,
          name: 'Freeport-TX',
          totalCapacity: 200,
          color: '#2ECC40',
        },
      ],
    };
    this.pipelines.forEach((pipeline) => {
      const operatorPipeline = {
        ...pipeline,
        nomination: 0,
      };
      operatorPipeline.allocations = {};
      this.counterParties.forEach((cp) => {
        operatorPipeline.allocations[cp.id] = 0;
      });
      this.state.operatorPipelines[pipeline.id] = operatorPipeline;
    });
    this.handleTradeFormChange = this.handleTradeFormChange.bind(this);
    this.handleOperatorFormChange = this.handleOperatorFormChange.bind(this);
  }

  componentDidMount() {
    this.graphContainer = document.getElementById('us-pipeline-visualisation-container');
    this.updateGraph();
  }

  updateGraph = (reload) => {
    const nodes = this.state.terminals;

    const getCapacityValue = (pipelineSource) => {
      const { totalCapacity } = nodes[pipelineSource];
      const commonSource = this.pipelines.filter(p => p.source === pipelineSource).length;
      return totalCapacity / commonSource;
    };
    const getAllocationValue = (pipelineId) => {
      let allocationValue = 0;
      if (this.state.tab === 'shipper') {
        allocationValue = this.state.operatorPipelines[pipelineId].allocations[this.state.shipper];
      } else if (this.state.tab === 'operator') {
        const opa = this.state.operatorPipelines[pipelineId].allocations;
        allocationValue = Object.keys(opa).map(cp => opa[cp]).reduce((total, cp) => total + cp);
      }
      return allocationValue;
    };
    const getNominationValue = (pipelineId) => {
      const trades = this.state.trades.filter(trade => trade.counterparty.id !== this.state.shipper);
      let nominationValue = 0;
      trades.forEach((trade) => {
        if (trade.pipeline && trade.pipeline.id === pipelineId) {
          nominationValue += parseInt(trade.volume);
        }
      });
      return nominationValue;
    };

    const nominations = this.pipelines.map((pipeline) => {
      const nomination = {
        ltype: 'nomination',
        ...pipeline,
        value: 0,
        color: '#0074D9',
      };

      nomination.value = getNominationValue(pipeline.id);
      const allocationValue = getAllocationValue(pipeline.id);
      const capacity = getCapacityValue(pipeline.source);

      if (nomination.value > allocationValue) {
        nomination.color = '#FF4136';
        nomination.overload = nomination.value;
        nomination.value = allocationValue < capacity ? allocationValue : capacity;
      }

      return nomination;
    });

    const allocations = this.pipelines.map((pipeline) => {
      let allocationValue = getAllocationValue(pipeline.id);
      const nomination = nominations.find(nom => nom.id === pipeline.id);
      const capacity = getCapacityValue(pipeline.source);
      console.log(pipeline.name, 'alloc', allocationValue, 'nom', nomination.value, 'capacity', capacity);

      if (allocationValue >= nomination.value) {
        allocationValue -= nomination.value;
      }

      const allocation = {
        ltype: 'allocation',
        ...pipeline,
        value: allocationValue,
        id: `${pipeline.id}-allocation`,
        name: `${pipeline.name} Allocation`,
        color: '#FFDC00',
      };

      if (capacity - (nomination.value + allocationValue) < 0) {
        allocation.overload = allocation.value;
        allocation.value = capacity - nomination.value;
        allocation.color = '#FF851B';
      }

      return allocation;
    });

    const spareCapacities = this.pipelines.map((pipeline) => {
      let spareValue = 0;
      let name = '';
      if (this.state.tab === 'operator') {
        name = `${pipeline.name} Spare Capacity`;
      }

      const allocationValue = getAllocationValue(pipeline.id);
      const nomination = nominations.find(nom => nom.id === pipeline.id);
      const capacity = getCapacityValue(pipeline.source);

      if (capacity - (nomination.value + allocationValue) < 0) {
        spareValue = 0;
      } else {
        spareValue = capacity - allocationValue;
      }
      console.log('SPARE', pipeline.name, 'alloc', allocationValue, 'nom', nomination.value, 'spare', spareValue, 'capacity', capacity);
      return {
        ltype: 'spare',
        ...pipeline,
        value: spareValue,
        id: `${pipeline.id}-spare`,
        name,
        color: '#AAAAAA',
      };
    });

    const links = [...spareCapacities, ...allocations, ...nominations];
    const graphData = {
      nodes,
      links,
    };
    console.log('graph-data', graphData);
    this.graphContainer.setAttribute('data-init', JSON.stringify(graphData));
    if (reload) {
      this.graphContainer.setAttribute('data-reload', new Date().getTime());
    }
  }

  updateOperatorPipelines = () => {
    const operatorPipelines = this.state.operatorPipelines;
    this.pipelines.forEach((pipeline) => {
      let nomination = 0;
      this.state.trades.forEach((trade) => {
        if (trade.pipeline && trade.pipeline.id === pipeline.id) {
          nomination += parseInt(trade.volume);
        }
      });
      operatorPipelines[pipeline.id].nomination = nomination;
    });
    this.setState({ operatorPipelines });
  }

  getPipeLineById = id => this.pipelines.find(pipeline => pipeline.id === id)

  getCounterPartyById = id => this.counterParties.find(cp => cp.id === id)

  getOperators = () => {
    const trades = this.state.trades;
    const pipeline = this.state.pipelines;

    const operators = [];
    trades.reduce((res, trade) => {
      const accIndex = res.pipeline.id;
      if (!res[accIndex]) {
        res[accIndex] = {
          id: new Date().getTime(),
          pipeline: res.pipeline.id,
          nomination: 0,
          allocations: {
            CPA: 0,
            CPB: 0,
            CPC: 0,
          },
        };
        operators.push(res[accIndex]);
      }
      res[accIndex].nomination += parseInt(trade.volume);
      return res;
    }, {});
    return operators;
  }

  editTrade = (trade) => {
    const form = { ...trade };
    form.pipeline = trade.pipeline.id;
    form.counterparty = trade.counterparty.id;
    console.log('Trade Edited', form);
    this.setState({
      form,
      isEditing: true,
      editTrade: trade,
    });
  }

  deleteTrade = (tradeId, index) => {
    console.log('Trade Deleted', tradeId);
    const trades = this.state.trades;
    const deletedTrades = trades.filter((trade, index) => trade.id !== tradeId);
    console.log('deleted trades', deletedTrades);
    this.setState({
      trades: deletedTrades.slice(0),
      isEditing: false,
    }, () => {
      this.updateOperatorPipelines();
      this.updateGraph();
    });
  }

  handleTrade = (tradeId) => {
    console.log('Trade Submitted');

    const newTrade = { ...this.state.form };
    newTrade.pipeline = this.getPipeLineById(this.state.form.pipeline);
    newTrade.counterparty = this.getCounterPartyById(this.state.form.counterparty);
    // TODO validation
    const trades = this.state.trades;
    if (this.state.isEditing) {
      const editTrade = this.state.editTrade;
      const editTradeIndex = this.state.trades.findIndex(trade => trade.id === editTrade.id);
      trades[editTradeIndex] = newTrade;
    } else {
      newTrade.id = new Date().getTime();
      trades.push(newTrade);
    }

    this.setState({
      ...trades,
      isEditing: false,
      form: { ...this.emptyForm },
    }, () => {
      console.log(this.state);
      this.updateOperatorPipelines();
      this.updateGraph();
    });
  }

  handleTradeFormChange = (e) => {
    e.preventDefault();
    const target = e.target;
    const form = this.state.form;
    form[target.name] = target.value;
    this.setState({
      form: { ...form },
    });
  }

  handleTerminalCapacityChange = (e, terminalId) => {
    e.preventDefault();
    const target = e.target;
    const terminals = this.state.terminals;
    terminals[terminalId].totalCapacity = target.value;
    this.setState({
      terminals,
    }, () => {
      this.updateGraph(true); // reload
    });
  }

  handleOperatorFormChange = (e, pipelineId, counterPartyId) => {
    e.preventDefault();
    const target = e.target;
    const operatorPipelines = this.state.operatorPipelines;
    operatorPipelines[pipelineId].allocations[counterPartyId] = parseInt(target.value);
    this.setState({ operatorPipelines }, () => {
      this.updateGraph();
    });
  }

  handleFlowDirection = (e) => {
    const configs = this.state.configs;
    configs.toggleFlow = !configs.toggleFlow;
    this.setState({
      configs,
    });
    const canvasFlow = document.querySelector('.sk-canvas');
    canvasFlow && canvasFlow.classList.toggle('canvas-hidden');
  }

  handleTabSwitch = (tab) => {
    this.setState({ tab }, () => {
      this.updateGraph();
    });
  }

  handleConfigTabSwitch = (ctab) => {
    this.setState({ ctab });
  };

  handleSwitchShipper = (e) => {
    e.preventDefault();
    const target = e.target;
    this.setState({
      shipper: target.value,
    }, () => {
      this.updateGraph();
    });
  }

  render() {
    return (
      <div className="App">
        <div className="App-header container is-fluid">
          <div className="columns">
            <div className="column is-8">
              <div className="box">
                <div className="tabs">
                  <ul className="tabs-ops">
                    <li className={this.state.tab === 'shipper' ? 'is-active' : ''}>
                      <a onClick={() => { this.handleTabSwitch('shipper'); }}>Shipper</a>
                    </li>
                    <li className={this.state.tab === 'operator' ? 'is-active' : ''}>
                      <a onClick={() => { this.handleTabSwitch('operator'); }}>Operator</a>
                    </li>
                    <div className="shipper-selector">
                      <span>Shipper:</span>
                      <div className="select">
                        <select name="counterparty" value={this.state.shipper} onChange={this.handleSwitchShipper}>
                          {this.counterParties.map(cp => (
                            <option value={cp.id} key={cp.id}>{cp.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </ul>
                </div>
                {this.state.tab === 'shipper' && (
                <div className="tab-content-shipper">
                  <h1 className="box__heading">Trade History</h1>
                  <form>
                    <table className="table is-striped is-fullwidth">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Volume</th>
                          <th>Pipeline</th>
                          <th>Counterparty</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {this.state.trades && this.state.trades.filter(trade => trade.counterparty.id !== this.state.shipper).map((trade, index) => (
                          <tr key={trade.id}>

                            <td>
                              {trade.month}
                            </td>

                            <td>
                              {trade.volume}
                            </td>

                            <td>
                              {trade.pipeline && trade.pipeline.name}
                            </td>

                            <td>
                              {trade.counterparty && trade.counterparty.name}
                            </td>
                            <td>
                              <div className="field is-grouped">
                                <p className="control">
                                  <button name="edit-button" className="button is-warning is-small" onClick={() => { this.editTrade(trade); }} type="button">Edit</button>
                                </p>
                                <p className="control">
                                  <button name="delete-button" className="button is-danger is-small" onClick={() => { this.deleteTrade(trade.id, index); }} type="button">Delete</button>
                                </p>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td>
                            <input className="input is-fullwidth" type="date" name="month" value={this.state.form.month} onChange={this.handleTradeFormChange} />
                          </td>
                          <td>
                            <input className="input is-fullwidth" type="number" step="100" name="volume" value={this.state.form.volume} onChange={this.handleTradeFormChange} />
                          </td>
                          <td>
                            <div className="select is-fullwidth">
                              <select name="pipeline" value={this.state.form.pipeline} onChange={this.handleTradeFormChange}>
                                <option>Select Pipeline</option>
                                {this.pipelines.map(pipeline => (
                                  <option value={pipeline.id} key={pipeline.id}>{pipeline.name}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td colSpan="2">
                            <div className="select is-fullwidth">
                              <select name="counterparty" value={this.state.form.counterparty} onChange={this.handleTradeFormChange}>
                                <option>Select Counterparty</option>
                                {this.counterParties.filter(cp => cp.id !== this.state.shipper).map(cp => (
                                  <option value={cp.id} key={cp.id}>{cp.name}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                    <button className={`button ${this.state.isEditing ? 'is-warning' : 'is-primary'}`} type="button" name="submit-button" onClick={() => { this.handleTrade(); }}>
                      {this.state.isEditing ? 'Edit Trade' : 'Save Trade'}
                    </button>
                  </form>
                </div>
                )}
                {this.state.tab === 'operator' && (
                <div className="tab-content-operator">
                  <h1 className="box__heading">Pipeline Allocation</h1>
                  <form>
                    <table className="table is-striped is-fullwidth">
                      <thead>
                        <tr>
                          <th>Pipeline</th>
                          <th>Nominations</th>
                          {this.counterParties.map(cp => (
                            <th>{cp.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(this.state.operatorPipelines).map((operatorPipelineId) => {
                          const operatorPipeline = this.state.operatorPipelines[operatorPipelineId];
                          return (
                            <tr key={operatorPipeline.id}>
                              <td>
                                {operatorPipeline.name}
                              </td>
                              <td>
                                {operatorPipeline.nomination}
                              </td>
                              {this.counterParties.map(cp => (
                                <td key={`${operatorPipelineId}-${cp.id}`}>
                                  <input className="input is-fullwidth" type="number" step="100" name="allocation" value={operatorPipeline.allocations[cp.id]} onChange={(e) => { this.handleOperatorFormChange(e, operatorPipeline.id, cp.id); }} />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </form>
                </div>
                )}
              </div>
            </div>
            <div className="column is-4">
              <div className="box">
                <div className="tabs">
                  <ul>
                    <li className={this.state.ctab === 'terminal' ? 'is-active' : ''}><a onClick={() => { this.handleConfigTabSwitch('terminal'); }}>Terminals</a></li>
                    <li className={this.state.ctab === 'config' ? 'is-active' : ''}><a onClick={() => { this.handleConfigTabSwitch('config'); }}>Configs</a></li>
                  </ul>
                </div>
                {this.state.ctab === 'terminal' && (
                  <div>
                    <table className="table is-fullwidth">
                      <tbody>
                        {this.state.terminals.map(terminal => (
                          <tr key={terminal.name}>
                            <td><span className="terminal-color" style={{ backgroundColor: terminal.color }} /> <span>{terminal.name}</span></td>
                            <td>
                              <input className="input has-text-right" type="number" step="100" name="terminal-name" value={terminal.totalCapacity} onChange={(e) => { this.handleTerminalCapacityChange(e, terminal.id); }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {this.state.ctab === 'config' && (
                  <div>
                    <h1 className="box__heading">Configure Settings</h1>
                    <div className="field is-grouped">
                      <p className="control">
                        <button className="button is-info" onClick={this.handleFlowDirection}>{this.state.configs.toggleFlow ? 'Hide' : 'Show'} Flow</button>
                      </p>
                      <p className="control">
                        <button className="button is-info" onClick={() => { this.updateGraph(true); }}>Reload Graph</button>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
