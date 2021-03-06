import { motion } from 'framer-motion';

import './HomeStyles.scss';
import WelcomeText from '../../components/WelcomeText/WelcomeText';
import OpenAIPlayground from '../../components/TextPredict/OpenAIPlayground';
import WelcomePitcure from '../../assets/images/grad-photo.jpg';
import CSULBLogo from '../../assets/images/csulb-logo.png';
import * as viewport from 'react-in-viewport';
import { Document, Page } from 'react-pdf';
import { useState } from 'react';

// import IntroCards from '../../components/IntroCard/IntroCards';

// Learn more: https://www.framer.com/docs/guides/code-components/

export default function Home() {
    //use react-in-viewport to make the the picture fade in when it is in view
    const [isInViewport, setIsInViewport] = useState(false);
    const [resumeOpen, setResumeOpen] = useState(false);
    const Block = (props: { inViewport: boolean }) => {
        return (
            <div className="csulbContainer">
                <motion.img
                    className="csulbLogo"
                    src={CSULBLogo}
                    variants={logoVariants}
                    initial="initial"
                    animate={isInViewport ? 'inView' : 'outOfView'}
                    id="csulbLogo"
                    alt="csulb-logo"
                    drag="y"
                    dragConstraints={{ top: 60, bottom: 60 }}
                    dragTransition={{ bounceStiffness: 600, bounceDamping: 10 }}
                />
                <div className="csulbText">
                    <h1>I currently attend CSULB</h1>
                    <p>
                        {' '}
                        My major is Computer Science and I am a Junior at
                        California State University, Long Beach.
                    </p>
                    <p> I am interested in the following fields:</p>
                    <ul>
                        <li> Web Development, and Software Engineering</li>
                        <li> Cyber Security, and Computer Networking</li>
                        <li>
                            {' '}
                            Data Science, Machine Learning, and Artificial
                            Intelligence
                        </li>
                    </ul>
                </div>
                <div>
                    {/* create a button to view resume */}
                    <button
                        onClick={() => setResumeOpen(!resumeOpen)}
                        className="resumeButton"
                    >
                        View Resume
                    </button>
                    <motion.a
                        variants={reusmeVariants}
                        whileHover="hover"
                        whileTap="tap"
                        href={require('../../assets/files/stephen-lyons-resume.pdf')}
                        download="stephen-lyons-resume"
                    >
                        <button className="resumeButton">
                            Download Resume
                        </button>
                    </motion.a>
                </div>
                {resumeOpen && (
                    <motion.div
                        transition={{
                            type: 'spring',
                            stiffness: 60,
                            damping: 60,
                        }}
                    >
                        <Document file="../../assets/files/stephen-lyons-resume.pdf">
                            <Page pageNumber={1} />
                        </Document>
                    </motion.div>
                )}
            </div>
        );
    };
    const ViewportBlock = viewport.handleViewport(Block);
    const animateLogo = () => {
        setIsInViewport(true);
        console.log('logo is in view');
    };

    return (
        <motion.div
            className="homeContainerStyle"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            <div className="welcomeContainer">
                <WelcomeText />

                <motion.img
                    src={WelcomePitcure}
                    className="welcomePicture"
                    alt="welcome"
                    variants={IntroPictureVariants}
                    initial="initial"
                    animate="visible"
                    whileTap="tap"
                    whileHover="hover"
                    drag="x"
                    dragConstraints={{ left: 60, right: 60 }}
                    dragTransition={{ bounceStiffness: 600, bounceDamping: 10 }}
                />
            </div>
            {/* create a button similar to the nav buttons that downloads my resume*/}

            <hr />
            {/* Create a div about the college, load the CSULB logo from assets and display in a flex container with row format */}
            <ViewportBlock onEnterViewport={animateLogo} />
            <hr />
            <h1>OpenAI Demonstration</h1>

            <OpenAIPlayground />

            {/* <motion.div className="introCards" drag>
                <IntroCard height={randomHeight()} />
                <IntroCard height={randomHeight()} />
                <IntroCard height={randomHeight()} />
                <IntroCard height={randomHeight()} />
            </motion.div> */}
        </motion.div>
    );
}

Home.defaultProps = {
    text: 'Tap',
};
const IntroPictureVariants = {
    initial: {
        transition: {
            delay: 3,
            duration: 1,
        },
    },
    visible: {
        transition: {
            type: 'spring',
            stiffness: 200,
            damping: 20,
        },
    },
    hover: {
        scale: 1.1,
        cursor: 'grab',
    },
    tap: {
        scale: 0.9,
        cursor: 'grabbing',
    },
};
const logoVariants = {
    inView: {
        opacity: 1,
        transition: {
            delay: 1,
            duration: 1,
        },
    },
    outOfView: {
        opacity: 0,
        transition: {
            delay: 1,
            duration: 1,
        },
    },
};

const containerVariants = {
    hidden: { opacity: 0, y: '100vh' },
    visible: {
        opacity: 1,
        y: '0vh',
        transition: { duration: 1 },
    },
    exit: { x: '-100vw', transition: { ease: 'easeInOut' } },
};
const reusmeVariants = {
    hover: { scale: 1.1 },
    tap: { scale: 1.1, rotate: '5deg' },
};
