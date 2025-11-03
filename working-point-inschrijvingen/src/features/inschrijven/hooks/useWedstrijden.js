import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const useWedstrijden = () => {
    const [wedstrijden, setWedstrijden] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchWedstrijden = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('wedstrijden')
                    .select('*')
                    .order('datum');

                if (error) throw error;

                setWedstrijden(data);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchWedstrijden();
    }, []);

    return { wedstrijden, loading, error };
};

export default useWedstrijden;