--
-- PostgreSQL database dump
--

\restrict HDi1rNo753xSctHBX03uAbbezM4VLmDvgPtHEllkQ4dfKfq2wsvgwQ3AKC9todw

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-05-17 14:00:40

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 241 (class 1259 OID 34306)
-- Name: access_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.access_logs (
    id integer NOT NULL,
    event_type text NOT NULL,
    identifier text,
    full_name text,
    role text,
    ip_address text,
    status text NOT NULL,
    detail text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.access_logs OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 34305)
-- Name: access_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.access_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.access_logs_id_seq OWNER TO postgres;

--
-- TOC entry 5195 (class 0 OID 0)
-- Dependencies: 240
-- Name: access_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.access_logs_id_seq OWNED BY public.access_logs.id;


--
-- TOC entry 230 (class 1259 OID 34196)
-- Name: fraud_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fraud_alerts (
    id integer NOT NULL,
    phone_number text,
    amount real,
    fraud_score real,
    risk_level text,
    action text,
    alert_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    acknowledged boolean DEFAULT false
);


ALTER TABLE public.fraud_alerts OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 34195)
-- Name: fraud_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fraud_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fraud_alerts_id_seq OWNER TO postgres;

--
-- TOC entry 5196 (class 0 OID 0)
-- Dependencies: 229
-- Name: fraud_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fraud_alerts_id_seq OWNED BY public.fraud_alerts.id;


--
-- TOC entry 232 (class 1259 OID 34208)
-- Name: money_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.money_transfers (
    id integer NOT NULL,
    sender_id integer NOT NULL,
    recipient_phone text NOT NULL,
    amount real NOT NULL,
    fee real DEFAULT 0.0,
    transfer_type text NOT NULL,
    network text NOT NULL,
    reference_number text,
    status text DEFAULT 'pending'::text,
    fraud_score real DEFAULT 0.0,
    ml_score real DEFAULT 0.0,
    rule_score real DEFAULT 0.0,
    risk_level text DEFAULT 'LOW'::text,
    is_fraud boolean DEFAULT false,
    face_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    notes text
);


ALTER TABLE public.money_transfers OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 34207)
-- Name: money_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.money_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.money_transfers_id_seq OWNER TO postgres;

--
-- TOC entry 5197 (class 0 OID 0)
-- Dependencies: 231
-- Name: money_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.money_transfers_id_seq OWNED BY public.money_transfers.id;


--
-- TOC entry 234 (class 1259 OID 34239)
-- Name: network_fees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.network_fees (
    id integer NOT NULL,
    network text NOT NULL,
    min_amount real DEFAULT 0,
    max_amount real DEFAULT 999999999,
    fee_type text DEFAULT 'fixed'::text,
    fee_amount real DEFAULT 0,
    percentage_fee real DEFAULT 0
);


ALTER TABLE public.network_fees OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 34238)
-- Name: network_fees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.network_fees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.network_fees_id_seq OWNER TO postgres;

--
-- TOC entry 5198 (class 0 OID 0)
-- Dependencies: 233
-- Name: network_fees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.network_fees_id_seq OWNED BY public.network_fees.id;


--
-- TOC entry 235 (class 1259 OID 34254)
-- Name: over_balance_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.over_balance_attempts (
    user_id integer NOT NULL,
    attempt_count integer DEFAULT 0,
    last_attempt timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.over_balance_attempts OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 34268)
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    is_used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 34267)
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO postgres;

--
-- TOC entry 5199 (class 0 OID 0)
-- Dependencies: 236
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- TOC entry 228 (class 1259 OID 34179)
-- Name: pending_deposits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_deposits (
    id integer NOT NULL,
    user_id integer,
    amount real,
    reference text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pending_deposits OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 34178)
-- Name: pending_deposits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pending_deposits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pending_deposits_id_seq OWNER TO postgres;

--
-- TOC entry 5200 (class 0 OID 0)
-- Dependencies: 227
-- Name: pending_deposits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pending_deposits_id_seq OWNED BY public.pending_deposits.id;


--
-- TOC entry 226 (class 1259 OID 34162)
-- Name: pin_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pin_attempts (
    id integer NOT NULL,
    user_phone text,
    attempt_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    was_successful boolean DEFAULT false,
    ip_address text,
    device_id text
);


ALTER TABLE public.pin_attempts OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 34161)
-- Name: pin_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pin_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pin_attempts_id_seq OWNER TO postgres;

--
-- TOC entry 5201 (class 0 OID 0)
-- Dependencies: 225
-- Name: pin_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pin_attempts_id_seq OWNED BY public.pin_attempts.id;


--
-- TOC entry 243 (class 1259 OID 34323)
-- Name: service_providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_providers (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    national_id text,
    sex text,
    password text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.service_providers OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 34322)
-- Name: service_providers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.service_providers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.service_providers_id_seq OWNER TO postgres;

--
-- TOC entry 5202 (class 0 OID 0)
-- Dependencies: 242
-- Name: service_providers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.service_providers_id_seq OWNED BY public.service_providers.id;


--
-- TOC entry 224 (class 1259 OID 34145)
-- Name: transaction_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transaction_history (
    id integer NOT NULL,
    user_phone text,
    amount real,
    transaction_type text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    recipient_phone text,
    is_fraud boolean DEFAULT false,
    fraud_score real
);


ALTER TABLE public.transaction_history OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 34144)
-- Name: transaction_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transaction_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transaction_history_id_seq OWNER TO postgres;

--
-- TOC entry 5203 (class 0 OID 0)
-- Dependencies: 223
-- Name: transaction_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transaction_history_id_seq OWNED BY public.transaction_history.id;


--
-- TOC entry 222 (class 1259 OID 34129)
-- Name: travel_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.travel_records (
    id integer NOT NULL,
    user_phone text,
    departure_date timestamp without time zone,
    return_date timestamp without time zone,
    destination_country text,
    sim_deactivated boolean DEFAULT false
);


ALTER TABLE public.travel_records OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 34128)
-- Name: travel_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.travel_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.travel_records_id_seq OWNER TO postgres;

--
-- TOC entry 5204 (class 0 OID 0)
-- Dependencies: 221
-- Name: travel_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.travel_records_id_seq OWNED BY public.travel_records.id;


--
-- TOC entry 239 (class 1259 OID 34285)
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 34284)
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5205 (class 0 OID 0)
-- Dependencies: 238
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- TOC entry 220 (class 1259 OID 34102)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    phone_number text NOT NULL,
    full_name text NOT NULL,
    national_id text NOT NULL,
    email text NOT NULL,
    password_hash text DEFAULT ''::text,
    salt text DEFAULT ''::text,
    gender text DEFAULT ''::text,
    registration_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    face_encoding bytea,
    face_image_path text,
    verification_status text DEFAULT 'pending'::text,
    account_balance real DEFAULT 0.0,
    last_login timestamp without time zone,
    pin_hash text,
    pin_blocked boolean DEFAULT false,
    pin_fail_count integer DEFAULT 0,
    insuf_count integer DEFAULT 0,
    role text DEFAULT 'user'::text,
    pin_salt text DEFAULT ''::text,
    pin_attempts integer DEFAULT 0
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 34101)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5206 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4966 (class 2604 OID 34309)
-- Name: access_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_logs ALTER COLUMN id SET DEFAULT nextval('public.access_logs_id_seq'::regclass);


--
-- TOC entry 4940 (class 2604 OID 34199)
-- Name: fraud_alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_alerts ALTER COLUMN id SET DEFAULT nextval('public.fraud_alerts_id_seq'::regclass);


--
-- TOC entry 4943 (class 2604 OID 34211)
-- Name: money_transfers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.money_transfers ALTER COLUMN id SET DEFAULT nextval('public.money_transfers_id_seq'::regclass);


--
-- TOC entry 4953 (class 2604 OID 34242)
-- Name: network_fees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.network_fees ALTER COLUMN id SET DEFAULT nextval('public.network_fees_id_seq'::regclass);


--
-- TOC entry 4961 (class 2604 OID 34271)
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- TOC entry 4937 (class 2604 OID 34182)
-- Name: pending_deposits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_deposits ALTER COLUMN id SET DEFAULT nextval('public.pending_deposits_id_seq'::regclass);


--
-- TOC entry 4934 (class 2604 OID 34165)
-- Name: pin_attempts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pin_attempts ALTER COLUMN id SET DEFAULT nextval('public.pin_attempts_id_seq'::regclass);


--
-- TOC entry 4968 (class 2604 OID 34326)
-- Name: service_providers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_providers ALTER COLUMN id SET DEFAULT nextval('public.service_providers_id_seq'::regclass);


--
-- TOC entry 4931 (class 2604 OID 34148)
-- Name: transaction_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_history ALTER COLUMN id SET DEFAULT nextval('public.transaction_history_id_seq'::regclass);


--
-- TOC entry 4929 (class 2604 OID 34132)
-- Name: travel_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_records ALTER COLUMN id SET DEFAULT nextval('public.travel_records_id_seq'::regclass);


--
-- TOC entry 4964 (class 2604 OID 34288)
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- TOC entry 4915 (class 2604 OID 34105)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5187 (class 0 OID 34306)
-- Dependencies: 241
-- Data for Name: access_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.access_logs (id, event_type, identifier, full_name, role, ip_address, status, detail, created_at) FROM stdin;
1	LOGIN	ruhamorose@gmail.com		unknown	127.0.0.1	FAILED	No account found with these credentials.	2026-05-15 12:15:28.946385
2	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-15 13:57:09.190233
3	LOGOUT	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-15 14:11:18.264474
4	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-15 14:11:35.394295
5	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-15 14:19:35.360336
6	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-15 14:21:26.224727
7	LOGOUT	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-15 14:23:05.302923
8	LOGIN	ruhamorose@gmail.com		unknown	127.0.0.1	FAILED	Incorrect password.	2026-05-15 14:26:36.164931
9	LOGIN	ericuwinezastarboy@gmail.co		unknown	127.0.0.1	FAILED	No account found with these credentials.	2026-05-15 14:26:53.566409
10	LOGIN	ruhamorose@gmail.com		unknown	127.0.0.1	FAILED	Incorrect password.	2026-05-15 14:27:00.701804
11	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-15 14:27:10.780301
12	LOGOUT	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-15 14:38:52.906781
13	LOGIN	rosa@gmail.com	RUHAMO Rosa	user	127.0.0.1	SUCCESS		2026-05-15 14:39:13.120354
14	LOGOUT	rosa@gmail.com	RUHAMO Rosa	user	127.0.0.1	SUCCESS		2026-05-15 15:18:06.865426
15	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-15 15:18:31.931338
16	LOGOUT	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-15 15:18:50.140845
17	LOGIN	admin@amin.com		unknown	127.0.0.1	FAILED	No account found with these credentials.	2026-05-15 15:19:19.305945
18	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-15 15:19:30.509755
19	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-15 15:40:23.676438
20	LOGIN	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-15 15:59:28.106736
21	LOGOUT	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-15 16:00:27.160627
22	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-15 16:00:42.805966
23	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-15 16:08:09.508176
24	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-15 16:31:37.483566
25	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-15 16:35:41.405877
26	LOGIN	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-15 16:43:51.589676
27	LOGIN	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-15 17:59:17.046384
28	LOGOUT	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-15 18:08:58.112847
29	LOGIN	rosa@gmail.com	RUHAMO Rosa	user	127.0.0.1	SUCCESS		2026-05-15 18:09:13.587799
30	LOGOUT	rosa@gmail.com	RUHAMO Rosa	user	127.0.0.1	SUCCESS		2026-05-15 18:17:26.020167
31	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-15 18:17:45.037275
32	LOGIN	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-16 11:01:32.075727
33	LOGOUT	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-16 11:03:02.447883
34	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 11:03:33.178557
35	LOGOUT	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 11:11:12.624247
36	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-16 11:11:30.824717
37	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 11:43:09.242451
38	LOGOUT	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 12:20:34.966902
39	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 12:21:04.145916
40	FACE_UPDATE_FAIL	+250783287066	Ruhamo Rose	user	127.0.0.1	FAILED	No face detected in the submitted image.	2026-05-16 12:53:19.77757
41	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 13:00:45.259375
42	FACE_UPDATE_FAIL	+250783287066	Ruhamo Rose	user	127.0.0.1	FAILED	No face detected in the submitted image.	2026-05-16 13:03:15.20192
43	FACE_UPDATE_FAIL	+250783287066	Ruhamo Rose	user	127.0.0.1	FAILED	No face detected in the submitted image.	2026-05-16 13:03:26.577462
44	PIN_RESET_FACE_FAIL	+250783287066	Ruhamo Rose	user	127.0.0.1	FAILED	No face detected. Ensure your face is centred, well-lit, and not obscured.	2026-05-16 13:05:26.915538
45	PIN_RESET_FACE_FAIL	+250783287066	Ruhamo Rose	user	127.0.0.1	FAILED	No face detected. Ensure your face is centred, well-lit, and not obscured.	2026-05-16 13:05:36.370094
46	LOGOUT	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 13:05:51.619818
47	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 20:03:50.437933
48	LOGOUT	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 20:04:23.532494
49	LOGIN	admin@admin.com	Admin User	admin	127.0.0.1	SUCCESS		2026-05-16 20:04:36.590979
50	LOGIN	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-16 20:05:22.490023
51	LOGIN	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 20:10:42.230482
52	LOGOUT	ruhamorose@gmail.com	Ruhamo Rose	user	127.0.0.1	SUCCESS		2026-05-16 20:10:52.1953
53	LOGIN	provider@provider@gmail.com		unknown	127.0.0.1	FAILED	No account found with these credentials.	2026-05-16 20:11:10.478837
54	LOGIN	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-16 20:11:42.469771
55	LOGOUT	provider@provider.com	Provider	provider	127.0.0.1	SUCCESS		2026-05-16 20:12:09.913929
\.


--
-- TOC entry 5176 (class 0 OID 34196)
-- Dependencies: 230
-- Data for Name: fraud_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fraud_alerts (id, phone_number, amount, fraud_score, risk_level, action, alert_message, created_at, acknowledged) FROM stdin;
\.


--
-- TOC entry 5178 (class 0 OID 34208)
-- Dependencies: 232
-- Data for Name: money_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.money_transfers (id, sender_id, recipient_phone, amount, fee, transfer_type, network, reference_number, status, fraud_score, ml_score, rule_score, risk_level, is_fraud, face_verified, created_at, completed_at, notes) FROM stdin;
1	3	+250783287066	200	20	mobile_money	MTN	TXN20260515418663	completed	0.0001	0.0001	0	LOW	f	f	2026-05-15 15:17:49.347558	2026-05-15 15:17:49.345974	Transaction approved.
2	3	+250783287066	500	20	mobile_money	MTN	TXN20260515273860	blocked	0	0	0	HIGH	t	f	2026-05-15 18:09:48.012609	\N	Account is inactive. If you are abroad, please contact your service provider to reactivate.
3	3	+250783287066	500	20	mobile_money	MTN	TXN20260515553039	completed	0.0001	0.0001	0	LOW	f	f	2026-05-15 18:16:11.88589	2026-05-15 18:16:11.885221	Transaction approved.
4	1	+250780000001	200	20	mobile_money	MTN	TXN20260516325302	completed	0.0002	0.0002	0	LOW	f	f	2026-05-16 11:54:45.989755	2026-05-16 11:54:45.988701	Transaction approved.
\.


--
-- TOC entry 5180 (class 0 OID 34239)
-- Dependencies: 234
-- Data for Name: network_fees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.network_fees (id, network, min_amount, max_amount, fee_type, fee_amount, percentage_fee) FROM stdin;
313	MTN	1	1000	fixed	20	0
314	MTN	1001	10000	fixed	100	0
315	MTN	10001	150000	fixed	250	0
316	MTN	150001	2e+06	fixed	1500	0
317	Airtel	1	1000	fixed	20	0
318	Airtel	1001	10000	fixed	100	0
319	Airtel	10001	150000	fixed	250	0
320	Airtel	150001	2e+06	fixed	1500	0
\.


--
-- TOC entry 5181 (class 0 OID 34254)
-- Dependencies: 235
-- Data for Name: over_balance_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.over_balance_attempts (user_id, attempt_count, last_attempt) FROM stdin;
\.


--
-- TOC entry 5183 (class 0 OID 34268)
-- Dependencies: 237
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, email, token, expires_at, is_used, created_at) FROM stdin;
\.


--
-- TOC entry 5174 (class 0 OID 34179)
-- Dependencies: 228
-- Data for Name: pending_deposits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pending_deposits (id, user_id, amount, reference, status, created_at) FROM stdin;
\.


--
-- TOC entry 5172 (class 0 OID 34162)
-- Dependencies: 226
-- Data for Name: pin_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pin_attempts (id, user_phone, attempt_time, was_successful, ip_address, device_id) FROM stdin;
\.


--
-- TOC entry 5189 (class 0 OID 34323)
-- Dependencies: 243
-- Data for Name: service_providers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.service_providers (id, name, email, phone, national_id, sex, password, is_active, created_at) FROM stdin;
1	Provider	provider@provider.com	0781111111	120008001111111	Male	43fcbcb32ded8ec8770e4b7a220790fc264967b1582c4580428b9fbfecad17fa	t	2026-05-15 15:48:44.822877
\.


--
-- TOC entry 5170 (class 0 OID 34145)
-- Dependencies: 224
-- Data for Name: transaction_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transaction_history (id, user_phone, amount, transaction_type, "timestamp", recipient_phone, is_fraud, fraud_score) FROM stdin;
1	+250780000001	200	TRANSFER	2026-05-15 15:17:48.718143	+250783287066	f	0.4
2	+250780000001	500	TRANSFER	2026-05-15 18:16:11.461303	+250783287066	f	0
3	+250783287066	200	TRANSFER	2026-05-16 11:54:45.193045	+250780000001	f	0.4
\.


--
-- TOC entry 5168 (class 0 OID 34129)
-- Dependencies: 222
-- Data for Name: travel_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.travel_records (id, user_phone, departure_date, return_date, destination_country, sim_deactivated) FROM stdin;
\.


--
-- TOC entry 5185 (class 0 OID 34285)
-- Dependencies: 239
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_sessions (id, user_id, session_token, expires_at, created_at) FROM stdin;
17	2	GVrQsCn2m6tPGCTpTsVkZONKCNlWwIxXLHmJRWzMaqM	2026-05-17 11:11:30.777747	2026-05-16 11:11:30.775297
19	1	rnrb8EUGOBiYWei6aFlC242pAJPL9WPwdqXMLX0vBrk	2026-05-17 12:21:03.994757	2026-05-16 12:21:03.989906
22	2	xaxmyTUEQGeMYshvoMBTMtS6ncL7ZMtGpS-_-Pg4lpA	2026-05-17 20:04:36.548544	2026-05-16 20:04:36.54683
\.


--
-- TOC entry 5166 (class 0 OID 34102)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, phone_number, full_name, national_id, email, password_hash, salt, gender, registration_date, is_active, face_encoding, face_image_path, verification_status, account_balance, last_login, pin_hash, pin_blocked, pin_fail_count, insuf_count, role, pin_salt, pin_attempts) FROM stdin;
3	+250780000001	RUHAMO Rosa	1199970051622070	rosa@gmail.com	b686996277c2d1e28a5f3b88accb252075973918fa2e8c90da222520abb0e5aa	5682e78a14c6ec0a69191be49a57d628	Female	2026-05-15 14:24:55.235334	t	\\x00000040cc76c4bf000000c08385be3f000000c07cafbb3f00000000535f913f0000000097b16ebf000000c0041cc0bf000000c0a32daf3f000000004b35b0bf000000602744c03f000000805dc5b3bf00000040e6c4d33f00000000ab98a9bf000000805a79c8bf00000060e81fc2bf000000a038f7b43f000000c093b2ba3f000000e05756c5bf000000c0e3ddb8bf000000804105babf000000e0960bbcbf000000407318a23f00000000b7b5a23f00000060ca02673f00000080e1d3a83f000000e00036b3bf000000208fced3bf00000080e7e6b6bf000000402309c7bf000000e08f0dbc3f000000803b28b5bf000000c051ceb73f000000a0ba52a93f0000002093a8c1bf0000000038e6a1bf00000060763babbf000000e0b808abbf000000403b1cb83f000000c020a49abf000000e0b46cc93f00000000647770bf000000a02dd7c3bf000000007704b4bf00000020dc4eab3f000000c0b2a0d03f00000060d926c03f000000807b30b1bf00000060abc89d3f000000a09ebaa03f00000080c06cb13f000000a08566c9bf000000e0f8a8ac3f000000c06b28a93f000000003873cd3f000000e035b3a73f000000208025b93f0000004034d5c1bf0000006091e8afbf0000000020153d3f000000605008c3bf00000040000cb53f000000e0a67ebc3f000000a0e0c6a6bf00000080dde2c0bf000000e07156a5bf000000408d5bcd3f000000e094fab03f000000c0df43c0bf000000c04d9dc3bf00000000d6e6c33f00000040e4e4bcbf00000020ce1aa5bf000000c0b4abc63f000000808b45bcbf000000401ac8adbf00000000ccc7cebf000000a09469bf3f00000000641ad53f0000000049f7b13f0000002030dbc8bf00000040e54faabf00000060dd35cbbf00000080a43055bf000000003866a8bf000000c0fe6b853f00000080501aacbf000000003b6188bf000000c0c1d3bebf00000020e05d963f00000080c6aeba3f000000c09c9e7ebf000000e08e6ba8bf0000004018a1cc3f000000803fca70bf000000c06bc0823f000000a09c2faebf000000806fa69dbf000000808669abbf000000a0b1d0abbf0000002026fda7bf0000008074e495bf000000202a6fb63f00000040f7cca4bf000000c06950a3bf000000408e9eb33f000000a0ab08c6bf00000020738ebe3f00000040f8018f3f00000080ebf3853f000000e08008a13f00000000e0c4b83f000000208a05bbbf000000e031eaa0bf00000020c52abe3f000000a05f86cabf000000c013b5c13f000000e007f1b83f000000a0d4c0a13f00000020e9bbb23f000000800941903f00000000848eb23f000000c083b7a3bf000000c0eeebaabf00000060f007bebf000000806646b0bf000000409392af3f00000080dc19a9bf0000008049d0a4bf000000601ef8803f	\N	verified	99460	2026-05-15 18:09:13.537666	5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5	f	0	0	user		0
2	+250780000000	Admin User	1234567890123456	admin@admin.com	7f94e7c368d3aeb165c3130ce35a7705b5e2e4bf0e5cedc42678dee79edfc491		Male	2026-05-15 14:10:33.671504	t	\N	\N	verified	0	2026-05-16 20:04:36.54683	\N	f	0	0	admin		0
1	+250783287066	Ruhamo Rose	1199980051622070	ruhamorose@gmail.com	26cae4158538f4069919084b6373ffb9d12a703b264714eee0b14cc70707a9e5	a7196b98c8c33e3919904d6e5e1dcd2f	Male	2026-05-15 13:54:15.583676	t	\\x00000020c1d4c2bf0000000068a4bb3f000000e0e332c03f000000409b149a3f00000040fad2a6bf000000400c90b7bf000000c0417daf3f000000e09c00b1bf000000a0d45ac23f000000c0056ab4bf000000605edcd43f0000008031cb9bbf00000000d9f8c6bf000000e06d17c2bf000000c0a34eb23f00000040557fba3f00000020d7b8c4bf0000002053bdbebf00000080ba35b9bf000000802713bfbf00000000b86b823f000000803a1b9d3f00000060e6359cbf00000080f51aa43f000000a0f5fbb0bf00000080720dd4bf000000a017b4bbbf000000a06eb7c5bf00000000376eb63f0000004079a1b6bf000000c0f5b0b83f000000a0a645a13f000000c0761cc4bf0000008068bea9bf000000c00d65aebf000000607070b2bf00000020032db23f00000000419595bf00000020ca0dc63f00000000ff1093bf00000080ecc3c1bf000000805405a3bf000000606c5fa93f000000e0a486d13f000000407ab2be3f000000e0afbba1bf00000040333d843f0000000084949e3f00000000a089ac3f00000080381dc7bf0000002045eca13f000000e04459b63f000000604b31cc3f000000e05f58983f000000606f44b63f00000020e80ec0bf000000c0f490b2bf000000007684933f000000e0a46bc4bf0000000022f5b73f000000c09364b53f000000a02672acbf000000e07c10c0bf000000609164b2bf00000000e11bd03f000000403846b13f00000000ea03c0bf000000c01d99c3bf000000604475c43f00000000f99cbdbf000000c0ed0ba6bf0000004011dfc33f00000080836dc1bf0000008011bfb4bf00000000af7cd0bf000000c0096bc03f0000004000e0d63f000000c0b450ac3f0000008000f1c9bf000000a076a1a8bf0000000032a5cabf0000000098d78c3f000000004b87b0bf000000001559943f000000803b24adbf000000e00e5499bf00000040f149c0bf000000c05da98f3f00000040919fba3f00000040d2ed72bf00000000b728a2bf000000e0206fcd3f0000008065cc85bf000000e0bd8098bf000000202af3abbf000000808cc69fbf00000040458fa8bf000000208561b1bf000000a02ec7abbf0000006070319ebf00000000dc64b03f00000060e1eda7bf000000404ae2a2bf00000020fb3eb43f000000e003dec5bf00000020b963ba3f000000e0843d833f000000e05e02843f0000004072398f3f000000e09996b53f000000601e6ab9bf000000005634aabf000000a0692bc23f000000402d3ccdbf000000000d65c23f00000020e64bbb3f00000080b749993f0000002043d8b53f00000080a4ed60bf000000a0375cb53f00000020118ab4bf00000060bd46abbf00000080dbcebcbf0000002009d9aebf0000004091b7a53f00000040fbb2b1bf000000c0b22199bf000000c00d2f8e3f	\N	verified	100480	2026-05-16 20:10:42.177837	5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5	f	0	0	user		0
\.


--
-- TOC entry 5207 (class 0 OID 0)
-- Dependencies: 240
-- Name: access_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.access_logs_id_seq', 55, true);


--
-- TOC entry 5208 (class 0 OID 0)
-- Dependencies: 229
-- Name: fraud_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.fraud_alerts_id_seq', 1, false);


--
-- TOC entry 5209 (class 0 OID 0)
-- Dependencies: 231
-- Name: money_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.money_transfers_id_seq', 4, true);


--
-- TOC entry 5210 (class 0 OID 0)
-- Dependencies: 233
-- Name: network_fees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.network_fees_id_seq', 320, true);


--
-- TOC entry 5211 (class 0 OID 0)
-- Dependencies: 236
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- TOC entry 5212 (class 0 OID 0)
-- Dependencies: 227
-- Name: pending_deposits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pending_deposits_id_seq', 1, false);


--
-- TOC entry 5213 (class 0 OID 0)
-- Dependencies: 225
-- Name: pin_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pin_attempts_id_seq', 1, false);


--
-- TOC entry 5214 (class 0 OID 0)
-- Dependencies: 242
-- Name: service_providers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.service_providers_id_seq', 1, true);


--
-- TOC entry 5215 (class 0 OID 0)
-- Dependencies: 223
-- Name: transaction_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transaction_history_id_seq', 3, true);


--
-- TOC entry 5216 (class 0 OID 0)
-- Dependencies: 221
-- Name: travel_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.travel_records_id_seq', 1, false);


--
-- TOC entry 5217 (class 0 OID 0)
-- Dependencies: 238
-- Name: user_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_sessions_id_seq', 23, true);


--
-- TOC entry 5218 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- TOC entry 5006 (class 2606 OID 34317)
-- Name: access_logs access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4988 (class 2606 OID 34206)
-- Name: fraud_alerts fraud_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_alerts
    ADD CONSTRAINT fraud_alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 4990 (class 2606 OID 34230)
-- Name: money_transfers money_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.money_transfers
    ADD CONSTRAINT money_transfers_pkey PRIMARY KEY (id);


--
-- TOC entry 4992 (class 2606 OID 34232)
-- Name: money_transfers money_transfers_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.money_transfers
    ADD CONSTRAINT money_transfers_reference_number_key UNIQUE (reference_number);


--
-- TOC entry 4994 (class 2606 OID 34253)
-- Name: network_fees network_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.network_fees
    ADD CONSTRAINT network_fees_pkey PRIMARY KEY (id);


--
-- TOC entry 4996 (class 2606 OID 34261)
-- Name: over_balance_attempts over_balance_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.over_balance_attempts
    ADD CONSTRAINT over_balance_attempts_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4998 (class 2606 OID 34281)
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 5000 (class 2606 OID 34283)
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- TOC entry 4986 (class 2606 OID 34189)
-- Name: pending_deposits pending_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_deposits
    ADD CONSTRAINT pending_deposits_pkey PRIMARY KEY (id);


--
-- TOC entry 4984 (class 2606 OID 34172)
-- Name: pin_attempts pin_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pin_attempts
    ADD CONSTRAINT pin_attempts_pkey PRIMARY KEY (id);


--
-- TOC entry 5008 (class 2606 OID 34338)
-- Name: service_providers service_providers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_providers
    ADD CONSTRAINT service_providers_email_key UNIQUE (email);


--
-- TOC entry 5010 (class 2606 OID 34336)
-- Name: service_providers service_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_providers
    ADD CONSTRAINT service_providers_pkey PRIMARY KEY (id);


--
-- TOC entry 4982 (class 2606 OID 34155)
-- Name: transaction_history transaction_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_history
    ADD CONSTRAINT transaction_history_pkey PRIMARY KEY (id);


--
-- TOC entry 4980 (class 2606 OID 34138)
-- Name: travel_records travel_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_records
    ADD CONSTRAINT travel_records_pkey PRIMARY KEY (id);


--
-- TOC entry 5002 (class 2606 OID 34297)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 5004 (class 2606 OID 34299)
-- Name: user_sessions user_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);


--
-- TOC entry 4972 (class 2606 OID 34127)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4974 (class 2606 OID 34125)
-- Name: users users_national_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_national_id_key UNIQUE (national_id);


--
-- TOC entry 4976 (class 2606 OID 34123)
-- Name: users users_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);


--
-- TOC entry 4978 (class 2606 OID 34121)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5015 (class 2606 OID 34233)
-- Name: money_transfers money_transfers_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.money_transfers
    ADD CONSTRAINT money_transfers_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- TOC entry 5016 (class 2606 OID 34262)
-- Name: over_balance_attempts over_balance_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.over_balance_attempts
    ADD CONSTRAINT over_balance_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5014 (class 2606 OID 34190)
-- Name: pending_deposits pending_deposits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_deposits
    ADD CONSTRAINT pending_deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5013 (class 2606 OID 34173)
-- Name: pin_attempts pin_attempts_user_phone_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pin_attempts
    ADD CONSTRAINT pin_attempts_user_phone_fkey FOREIGN KEY (user_phone) REFERENCES public.users(phone_number);


--
-- TOC entry 5012 (class 2606 OID 34156)
-- Name: transaction_history transaction_history_user_phone_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_history
    ADD CONSTRAINT transaction_history_user_phone_fkey FOREIGN KEY (user_phone) REFERENCES public.users(phone_number);


--
-- TOC entry 5011 (class 2606 OID 34139)
-- Name: travel_records travel_records_user_phone_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_records
    ADD CONSTRAINT travel_records_user_phone_fkey FOREIGN KEY (user_phone) REFERENCES public.users(phone_number);


--
-- TOC entry 5017 (class 2606 OID 34300)
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


-- Completed on 2026-05-17 14:00:41

--
-- PostgreSQL database dump complete
--

\unrestrict HDi1rNo753xSctHBX03uAbbezM4VLmDvgPtHEllkQ4dfKfq2wsvgwQ3AKC9todw

