import React from "react";
import { Helmet } from "react-helmet";
import { CURRENT_ORIGIN } from "../constants";

export default function HelmetMetaData(props) {
	let pathname = "/";
	if (typeof window !== "undefined") {
		pathname = window.location.pathname || "/";
	}
	let normalizedOrigin = CURRENT_ORIGIN ? CURRENT_ORIGIN.replace(/\/+$/, "") : "";
	let currentUrl = normalizedOrigin ? normalizedOrigin + pathname : pathname;
	let defaultImagePath = `${process.env.PUBLIC_URL || ""}/assets/social-preview.jpg`;
	if (normalizedOrigin) {
		const normalizedPath = defaultImagePath.replace(/^\.?\//, "");
		defaultImagePath = `${normalizedOrigin}/${normalizedPath}`;
	}
	let quote = props.quote !== undefined ? props.quote : "";
	let title = props.title !== undefined ? props.title : "Secret Hitler Online";
	let image =
		props.image !== undefined
			? props.image
			: defaultImagePath;
	let description =
		props.description !== undefined
			? props.description
			: "Secret Hitler Online is a browser-based hidden-identity game for up to 20 players. " +
			  "Open a lobby, share the invite link, and play in your current deployment.";
	let hashtag =
		props.hashtag !== undefined ? props.hashtag : "#SecretHitlerOnline";
	return (
		<Helmet>
			<title>{title}</title>
			<meta charSet="utf-8" />
			<link rel="icon" href="favicon.ico" />
			<meta name="csrf_token" content="" />
			<meta property="type" content="website" />
			<meta property="url" content={currentUrl} />
			<meta
				name="viewport"
				content="width=device-width, initial-scale=1, shrink-to-fit=no"
			/>
			<meta name="msapplication-TileColor" content="#e05b2b" />
			<meta name="msapplication-TileImage" content="favicon.ico" />
			<meta name="theme-color" content="#e05b2b" />
			<meta name="_token" content="" />
			<meta property="title" content={title} />
			<meta property="quote" content={quote} />
			<meta name="description" content={description} />
			<meta property="image" content={image} />
			<meta property="og:type" content="website" />
			<meta property="og:title" content={title} />
			<meta property="og:quote" content={quote} />
			<meta property="og:hashtag" content={hashtag} />
			<meta property="og:image" content={image} />
			<meta content="image/*" property="og:image:type" />
			<meta property="og:url" content={currentUrl} />
			<meta property="og:site_name" content="Secret Hitler Online" />
			<meta property="og:description" content={description} />
			<meta
				name="keywords"
				content="Secret Hitler, party game, play, free, online, tabletop simulator, board game"
			/>
		</Helmet>
	);
}
