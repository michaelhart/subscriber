export interface Env {
    SUBSCRIBER_MANAGER: DurableObjectNamespace;
}

// Worker
export default {
    async fetch(request: Request, env: Env) {
        return await handleRequest(request, env);
    },
};

async function handleRequest(request: Request, env: Env) {
    let url = new URL(request.url);
    let evspotId = url.pathname.split('/')[1];
    if (!evspotId) {
        return new Response(
            "Select a Durable Object to contact by using the `evspotId` in the path. e.g. /A"
        );
    }

    // Check that the evspotId parameter only contains alphabetical characters (a-Z)
    // and its length is less than 32
    if (!/^[a-zA-Z]+$/.test(evspotId) || evspotId.length > 32) {
        return new Response(
            "Invalid 'evspotId' parameter. It should only contain alphabetical characters without spaces and be less than 32 characters long."
            , { status: 400 });  // 400 Bad Request
    }

    let id = env.SUBSCRIBER_MANAGER.idFromName(evspotId);
    let obj = env.SUBSCRIBER_MANAGER.get(id);

    let resp = await obj.fetch(request.url);
    let result = await resp.json();

    return new Response(JSON.stringify(result));
}

export class SubscriberManager {
    state: DurableObjectState;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
    }

    async fetch(request: Request) {
        let url = new URL(request.url);
        let subscribers: string[] = (await this.state.storage.get('subscribers')) || [];
        let removedEmail = null;

        switch (url.pathname.split('/')[2]) {
            case 'add':
                let newEmail = url.searchParams.get("email");
                if (newEmail) {
                    newEmail = newEmail.toLowerCase();
                    if (!subscribers.includes(newEmail)) {
                        subscribers.push(newEmail);
                    }
                }
                break;
            case 'unshift':
                if (subscribers.length > 0) {
                    removedEmail = subscribers.shift();
                }
                break;
            case '':
                // Just serve the current list of subscribers.
                break;
            default:
                return new Response('Not found', { status: 404 });
        }

        await this.state.storage.put('subscribers', subscribers);

        let result = {
            subscribers: subscribers,
            removed: removedEmail
        }
        return new Response(JSON.stringify(result));
    }
}
