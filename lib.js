const requestGithubToken = credentials => fetch(
    'https://github.com/login/oauth/access_token',
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify(credentials)
    }
).then(res => res.json()).catch(error => {
    throw new Error(JSON.stringify(error));
});

const requestGithubUserAccount = token => fetch(
    `https://api.github.com/user`, {
    method: "GET",
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Authorization': `Bearer ${token}`
    }
}
).then(data => data.json()).catch(error => {
    throw new Error(JSON.stringify(error))
});

const authorizeWithGithub = async (credentials) => {
    const { access_token } = await requestGithubToken(credentials);
    const githubUser = await requestGithubUserAccount(access_token);

    return { ...githubUser, access_token }
}

module.exports = authorizeWithGithub;