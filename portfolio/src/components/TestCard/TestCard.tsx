import React from 'react';
import { motion } from 'framer-motion';

const TestCard = () => {
    // const [selectedId, setSelectedId] = useState(null)
    // var items: React.FC = [];
    return (
        <motion.div>
            {/* <AnimateSharedLayout type="crossfade">
            {items.map( item: React.FC => (
                <motion.div layoutId={item.id} onClick={() => setSelectedId(item.id)}>
                <motion.h5>{item.subtitle}</motion.h5>
                <motion.h2>{item.title}</motion.h2>
                </motion.div>
            ))}
            
            <AnimatePresence>
                {selectedId && (
                <motion.div layoutId={selectedId}>
                    <motion.h5>{item.subtitle}</motion.h5>
                    <motion.h2>{item.title}</motion.h2>
                    <motion.button onClick={() => setSelectedId(null)} />
                </motion.div>
                )}
            </AnimatePresence>
            </AnimateSharedLayout> */}
        </motion.div>
    );
};

export default TestCard;