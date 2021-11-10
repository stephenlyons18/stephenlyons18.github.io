import React, { useState } from 'react';
import './OpenAIPlayground.scss';
import { CaretRight } from 'phosphor-react';

const OpenAIPlayground = () => {
    const [text, setText] = useState('The quick brown fox jumped');
    const [prediction, setPrediction] = useState('');
    // const [code, setCode] = useState('Create a for loop');
    // const [codePrediction, setCodePrediction] = useState('');
    const [temperature, setTemperature] = useState(0);

    const handleSubmit = (evt) => {
        evt.preventDefault();
        console.log(text);
        (async () => {
            const gptResponse = await openai.complete({
                engine: 'davinci',
                prompt: text,
                maxTokens: 100,
                temperature: 0,
                topP: 1,
                presencePenalty: 0,
                frequencyPenalty: 0,
                bestOf: 1,
                n: 1,
                stream: false,
                stop: ['\n', 'testing'],
            });

            setPrediction(gptResponse.data.choices[0].text);
        })();
    };
    // const handleCodeSubmit = (evt) => {
    //     evt.preventDefault();
    //     (async () => {
    //         const gptCodeResponse = await openai.complete({
    //             engine: 'cushman-codex',
    //             prompt: code,
    //             maxTokens: 2000,
    //             temperature: temperature,
    //             topP: 1,
    //             presencePenalty: 0,
    //             frequencyPenalty: 0,
    //             bestOf: 1,
    //             n: 1,
    //             stream: false,
    //             stop: ['\n', 'testing'],
    //         });
    //         setCodePrediction(gptCodeResponse.data.choices[0].text);
    //     })();
    // };

    const OpenAI = require('openai-api');
    const openAI_key = process.env.REACT_APP_OPENAI_API_KEY;
    const openai = new OpenAI(openAI_key);

    return (
        <div className="openAIform">
            <p>
                I was recently granted access to the OpenAI beta's for GPT-3 and
                Copilot. Below is a demonstration of what this library is
                capable of.
            </p>
            <p>
                Type in the box and see OpenAI predict the remainder of what you
                have to say, try some common English phrases like:
                <ul>
                    <li> "I think therefore ..."</li>
                    <li>or "A watched pot ..."</li>
                </ul>
            </p>
            <form onSubmit={handleSubmit} className="openAIform">
                <label style={{ width: '100%', paddingLeft: '5%' }}>
                    <p style={{ fontSize: '1.4em' }}>Powered by OpenAI:</p>
                    <div className="inputContainer">
                        <CaretRight size={48} className="blink" />
                        <input
                            className="openAIinput"
                            type="text"
                            value={text}
                            onChange={(e) => {
                                setText(e.target.value);
                                setPrediction('');
                            }}
                        />
                    </div>
                </label>
                <input type="submit" value="Submit" className="openAISubmit" />
            </form>
            {/* create a slider input to adjust the temperature */}
            <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => {
                    setTemperature(Number(e.target.value));
                }}
            />
            <p>Temperature: {temperature}</p>
            <div className="openAIresponse">
                <p>{text + ' ... ' + prediction}</p>
            </div>
        </div>
    );
};

export default OpenAIPlayground;
