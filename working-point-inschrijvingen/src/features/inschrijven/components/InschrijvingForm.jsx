import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { notifyOrganisator } from '@/lib/notifyOrganisator';
import Button from '@/ui/Button';
import Input from '@/ui/Input';

const InschrijvingForm = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [hp, setHp] = useState(''); // Honeypot field for spam protection
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        if (hp) {
            // Honeypot field should be empty
            setLoading(false);
            return;
        }

        const { data, error: insertError } = await supabase
            .from('inschrijvingen')
            .insert([{ name, email, rubriek: 'Algemeen' }]);

        if (insertError) {
            setError(insertError.message);
            setLoading(false);
            return;
        }

        await notifyOrganisator(data[0]);

        setSuccess(true);
        setLoading(false);
        setName('');
        setEmail('');
    };

    return (
        <form onSubmit={handleSubmit}>
            <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Naam"
                required
            />
            <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                required
            />
            <input
                type="text"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                style={{ display: 'none' }} // Honeypot field hidden from users
            />
            <Button type="submit" disabled={loading}>
                {loading ? 'Verzenden...' : 'Inschrijven'}
            </Button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {success && <p style={{ color: 'green' }}>Inschrijving succesvol!</p>}
        </form>
    );
};

export default InschrijvingForm;