import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as path from 'path';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { domainConfig } from '../domain-config';

export class TodoInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table for todos
    const todoTable = new dynamodb.Table(this, 'TodoTable', {
      tableName: 'todos',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change to RETAIN for production
    });

    // SES Email Identity
    const emailIdentity = new ses.EmailIdentity(this, 'TodoEmailIdentity', {
      identity: ses.Identity.email('ndawpa6989@gmail.com'),
    });

    // Common Lambda execution role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions to Lambda role
    todoTable.grantReadWriteData(lambdaExecutionRole);

    // Add explicit DynamoDB permissions
    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:ListTables'
      ],
      resources: [
        todoTable.tableArn,
        `${todoTable.tableArn}/*`
      ]
    }));

    // Add SES permissions for sending emails
    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail'
      ],
      resources: ['*']
    }));

        // Lambda function for creating todos
    const createTodoFunction = new lambda.Function(this, 'CreateTodoFunction', {
      functionName: 'create-todo',
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const ses = new AWS.SES();
        
        exports.handler = async (event) => {
            console.log('Create todo function called');
            console.log('Event body:', event.body);
            
            try {
                const { title, description, userId } = JSON.parse(event.body);
                
                if (!title) {
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ error: 'Title is required' })
                    };
                }

                const todo = {
                    id: Date.now().toString(),
                    title,
                    description: description || '',
                    completed: false,
                    userId: userId || 'default',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                console.log('Todo to create:', JSON.stringify(todo, null, 2));
                console.log('Table name:', process.env.TABLE_NAME);

                // Save to DynamoDB
                await dynamodb.put({
                    TableName: process.env.TABLE_NAME,
                    Item: todo
                }).promise();

                console.log('Todo saved to DynamoDB successfully');

                // Send email notification
                try {
                    const emailParams = {
                        Source: 'ndawpa6989@gmail.com', // Replace with your verified email
                        Destination: {
                            ToAddresses: ['ndawpa6989@gmail.com'] // Replace with your email
                        },
                        Message: {
                            Subject: {
                                Data: 'New Todo Created!',
                                Charset: 'UTF-8'
                            },
                            Body: {
                                Text: {
                                    Data: \`A new todo has been created!
                                    
Title: \${todo.title}
Description: \${todo.description}
User ID: \${todo.userId}
Created: \${todo.createdAt}
Todo ID: \${todo.id}

You can view all your todos at your todo application.\`,
                                    Charset: 'UTF-8'
                                },
                                Html: {
                                    Data: \`<h2>New Todo Created!</h2>
<p><strong>Title:</strong> \${todo.title}</p>
<p><strong>Description:</strong> \${todo.description}</p>
<p><strong>User ID:</strong> \${todo.userId}</p>
<p><strong>Created:</strong> \${todo.createdAt}</p>
<p><strong>Todo ID:</strong> \${todo.id}</p>
<br>
<p>You can view all your todos at your todo application.</p>\`,
                                    Charset: 'UTF-8'
                                }
                            }
                        }
                    };

                    await ses.sendEmail(emailParams).promise();
                    console.log('Email notification sent successfully');
                } catch (emailError) {
                    console.error('Error sending email:', emailError);
                    // Don't fail the todo creation if email fails
                }

                return {
                    statusCode: 201,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({
                        ...todo,
                        emailSent: true
                    })
                };
            } catch (error) {
                console.error('Error creating todo:', error);
                console.error('Error stack:', error.stack);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ 
                        error: 'Internal server error',
                        message: error.message,
                        stack: error.stack
                    })
                };
            }
        };
      `),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: todoTable.tableName,
      },
    });

    // Lambda function for getting todos
    const getTodosFunction = new lambda.Function(this, 'GetTodosFunction', {
      functionName: 'get-todos',
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const dynamodbService = new AWS.DynamoDB();
        
        exports.handler = async (event) => {
            console.log('Get todos function called');
            
            try {
                const { id } = event.pathParameters || {};
                const tableName = process.env.TABLE_NAME;
                console.log('Table name:', tableName);
                console.log('Looking for ID:', id);
                
                if (id) {
                    // Get specific todo
                    console.log('Getting specific todo with ID:', id);
                    const result = await dynamodb.get({
                        TableName: tableName,
                        Key: { id }
                    }).promise();
                    
                    console.log('DynamoDB result:', JSON.stringify(result, null, 2));
                    
                    if (!result.Item) {
                        return {
                            statusCode: 404,
                            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                            body: JSON.stringify({ error: 'Todo not found' })
                        };
                    }
                    
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify(result.Item)
                    };
                } else {
                    // Get all todos
                    console.log('Getting all todos');
                    const result = await dynamodb.scan({
                        TableName: tableName
                    }).promise();
                    
                    console.log('DynamoDB scan result:', JSON.stringify(result, null, 2));
                    
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify(result.Items || [])
                    };
                }
            } catch (error) {
                console.error('Error getting todos:', error);
                console.error('Error stack:', error.stack);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ 
                        error: 'Internal server error',
                        message: error.message
                    })
                };
            }
        };
      `),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: todoTable.tableName,
      },
    });

    // Lambda function for updating todos
    const updateTodoFunction = new lambda.Function(this, 'UpdateTodoFunction', {
      functionName: 'update-todo',
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
            try {
                const { id } = event.pathParameters || {};
                const { title, description, completed } = JSON.parse(event.body);
                
                if (!id) {
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ error: 'Todo ID is required' })
                    };
                }
                
                const updateExpression = [];
                const expressionAttributeValues = {};
                const expressionAttributeNames = {};
                
                if (title !== undefined) {
                    updateExpression.push('#title = :title');
                    expressionAttributeValues[':title'] = title;
                    expressionAttributeNames['#title'] = 'title';
                }
                
                if (description !== undefined) {
                    updateExpression.push('#description = :description');
                    expressionAttributeValues[':description'] = description;
                    expressionAttributeNames['#description'] = 'description';
                }
                
                if (completed !== undefined) {
                    updateExpression.push('#completed = :completed');
                    expressionAttributeValues[':completed'] = completed;
                    expressionAttributeNames['#completed'] = 'completed';
                }
                
                updateExpression.push('#updatedAt = :updatedAt');
                expressionAttributeValues[':updatedAt'] = new Date().toISOString();
                expressionAttributeNames['#updatedAt'] = 'updatedAt';
                
                const result = await dynamodb.update({
                    TableName: process.env.TABLE_NAME,
                    Key: { id },
                    UpdateExpression: 'SET ' + updateExpression.join(', '),
                    ExpressionAttributeValues: expressionAttributeValues,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ReturnValues: 'ALL_NEW'
                }).promise();
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(result.Attributes)
                };
            } catch (error) {
                console.error('Error updating todo:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Internal server error' })
                };
            }
        };
      `),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: todoTable.tableName,
      },
    });

    // Lambda function for deleting todos
    const deleteTodoFunction = new lambda.Function(this, 'DeleteTodoFunction', {
      functionName: 'delete-todo',
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
            try {
                const { id } = event.pathParameters || {};
                
                if (!id) {
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ error: 'Todo ID is required' })
                    };
                }
                
                await dynamodb.delete({
                    TableName: process.env.TABLE_NAME,
                    Key: { id }
                }).promise();
                
                return {
                    statusCode: 204,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: ''
                };
            } catch (error) {
                console.error('Error deleting todo:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Internal server error' })
                };
            }
        };
      `),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: todoTable.tableName,
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'TodoApi', {
      restApiName: 'Todo API',
      description: 'API for Todo application',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // API Gateway resources and methods
    const todos = api.root.addResource('todos');
    
    // GET /todos - List all todos
    todos.addMethod('GET', new apigateway.LambdaIntegration(getTodosFunction));
    
    // POST /todos - Create a new todo
    todos.addMethod('POST', new apigateway.LambdaIntegration(createTodoFunction));

    // GET /todos/{id} - Get a specific todo
    const todo = todos.addResource('{id}');
    todo.addMethod('GET', new apigateway.LambdaIntegration(getTodosFunction));
    
    // PUT /todos/{id} - Update a todo
    todo.addMethod('PUT', new apigateway.LambdaIntegration(updateTodoFunction));
    
    // DELETE /todos/{id} - Delete a todo
    todo.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTodoFunction));

    // Output the table name
    new cdk.CfnOutput(this, 'TableName', {
      value: todoTable.tableName,
      description: 'DynamoDB Table Name',
    });

    // Output the Lambda function names
    new cdk.CfnOutput(this, 'CreateTodoFunctionName', {
      value: createTodoFunction.functionName,
      description: 'Create Todo Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'GetTodosFunctionName', {
      value: getTodosFunction.functionName,
      description: 'Get Todos Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'UpdateTodoFunctionName', {
      value: updateTodoFunction.functionName,
      description: 'Update Todo Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'DeleteTodoFunctionName', {
      value: deleteTodoFunction.functionName,
      description: 'Delete Todo Lambda Function Name',
    });

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'TodoApiUrl',
    });

    // Output the SES Email Identity
    new cdk.CfnOutput(this, 'EmailIdentity', {
      value: emailIdentity.emailIdentityName,
      description: 'SES Email Identity for notifications',
      exportName: 'TodoEmailIdentity',
    });

    // S3 Bucket for hosting the frontend
    const websiteBucket = new s3.Bucket(this, 'TodoWebsiteBucket', {
      bucketName: `todo-app-440748827272-us-east-1`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // For SPA routing
      publicReadAccess: true, // Allow public read access for website hosting
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS, // Allow public read but block ACLs
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
      autoDeleteObjects: true, // For development
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Add public bucket policy for website hosting
    websiteBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject'],
      resources: [websiteBucket.arnForObjects('*')],
      principals: [new iam.AnyPrincipal()],
    }));

    // CloudFront Origin Access Identity (OAI) - Required for private S3 access
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity', {
      comment: 'OAI for Todo App S3 bucket',
    });

    // Grant CloudFront read access to S3 bucket
    websiteBucket.grantRead(originAccessIdentity);

    // Domain Configuration
    // ===================
    
    let hostedZone: route53.IHostedZone | undefined;
    let certificate: acm.ICertificate | undefined;
    let customDomainName: string | undefined;
    
    if (domainConfig.enableCustomDomain) {
      // Use domain configuration from config file
      const domainName = domainConfig.domainName;
      const subdomain = domainConfig.subdomain;
      customDomainName = subdomain ? `${subdomain}.${domainName}` : domainName;
      
      // Create Hosted Zone (instead of looking it up)
      hostedZone = new route53.HostedZone(this, 'TodoHostedZone', {
        zoneName: domainName,
        comment: `Hosted zone for ${domainName}`,
      });
      
      // SSL Certificate
      certificate = new acm.Certificate(this, 'TodoCertificate', {
        domainName: customDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'TodoDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      defaultRootObject: 'index.html',
      // Custom domain configuration (only if enabled)
      ...(customDomainName && certificate && {
        domainNames: [customDomainName],
        certificate: certificate,
      }),
    });

    // Route 53 DNS Record (only if custom domain is enabled)
    if (hostedZone && customDomainName) {
      new route53.ARecord(this, 'TodoAliasRecord', {
        zone: hostedZone,
        recordName: domainConfig.subdomain || '@',
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(distribution)
        ),
      });
    }



    // CI/CD Pipeline Infrastructure
    // =============================

    // S3 Bucket for pipeline artifacts
    const pipelineArtifactBucket = new s3.Bucket(this, 'PipelineArtifactBucket', {
      bucketName: `todo-pipeline-artifacts-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
    });

    // CodeBuild Project for building the frontend
    const buildProject = new codebuild.PipelineProject(this, 'FrontendBuildProject', {
      projectName: 'todo-frontend-build',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: false,
      },
      environmentVariables: {
        NODE_VERSION: {
          value: '18',
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
    });

    // Grant CodeBuild permissions to access S3 and CloudFront
    websiteBucket.grantReadWrite(buildProject);
    buildProject.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudfront:CreateInvalidation',
        'cloudfront:GetInvalidation',
        'cloudfront:ListInvalidations',
      ],
      resources: ['*'],
    }));

    // Pipeline
    const pipeline = new codepipeline.Pipeline(this, 'FrontendPipeline', {
      pipelineName: 'todo-frontend-pipeline',
      artifactBucket: pipelineArtifactBucket,
      crossAccountKeys: false,
    });

    // Source stage - GitHub repository
    const sourceOutput = new codepipeline.Artifact();
    
    // GitHub Source Action (recommended over CodeCommit)
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'Source',
      owner: 'ndawpa', // Replace with your GitHub username
      repo: 'todo-frontend', // Replace with your repository name
      branch: 'main',
      oauthToken: cdk.SecretValue.secretsManager('github-token', {
        jsonField: 'token',
      }),
      output: sourceOutput,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // Build stage
    const buildOutput = new codepipeline.Artifact();
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
      environmentVariables: {
        WEBSITE_BUCKET: {
          value: websiteBucket.bucketName,
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        },
        CLOUDFRONT_DISTRIBUTION_ID: {
          value: distribution.distributionId,
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        },
      },
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    // Deploy stage - Deploy to S3 and invalidate CloudFront
    const deployAction = new codepipeline_actions.S3DeployAction({
      actionName: 'Deploy',
      input: buildOutput,
      bucket: websiteBucket,
      extract: true,
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [deployAction],
    });

    // Alternative: GitHub Source Action (if you prefer GitHub over CodeCommit)
    // Uncomment the following section and comment out the CodeCommit section above
    /*
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'Source',
      owner: 'your-github-username',
      repo: 'your-frontend-repo',
      branch: 'main',
      oauthToken: cdk.SecretValue.secretsManager('github-token'),
      output: sourceOutput,
    });
    */

    // Outputs for CI/CD
    new cdk.CfnOutput(this, 'PipelineName', {
      value: pipeline.pipelineName,
      description: 'CodePipeline Name',
      exportName: 'TodoPipelineName',
    });

    new cdk.CfnOutput(this, 'BuildProjectName', {
      value: buildProject.projectName,
      description: 'CodeBuild Project Name',
      exportName: 'TodoBuildProjectName',
    });

    new cdk.CfnOutput(this, 'RepositoryName', {
      value: 'todo-frontend',
      description: 'GitHub Repository Name',
      exportName: 'TodoRepositoryName',
    });

    // Output the website URL
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: distribution.distributionDomainName,
      description: 'Frontend Website URL',
      exportName: 'TodoWebsiteURL',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 Bucket Name for frontend files',
      exportName: 'TodoS3BucketName',
    });

    new cdk.CfnOutput(this, 'S3WebsiteURL', {
      value: websiteBucket.bucketWebsiteDomainName,
      description: 'S3 Website URL (for debugging)',
      exportName: 'TodoS3WebsiteURL',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: 'TodoCloudFrontDistributionId',
    });

    // Domain outputs (only if custom domain is enabled)
    if (customDomainName && certificate && hostedZone) {
      new cdk.CfnOutput(this, 'CustomDomain', {
        value: customDomainName,
        description: 'Custom Domain URL',
        exportName: 'TodoCustomDomain',
      });

      new cdk.CfnOutput(this, 'CertificateArn', {
        value: certificate.certificateArn,
        description: 'SSL Certificate ARN',
        exportName: 'TodoCertificateArn',
      });

      new cdk.CfnOutput(this, 'HostedZoneId', {
        value: hostedZone.hostedZoneId,
        description: 'Route 53 Hosted Zone ID',
        exportName: 'TodoHostedZoneId',
      });

      new cdk.CfnOutput(this, 'NameServers', {
        value: cdk.Fn.join(', ', hostedZone.hostedZoneNameServers || []),
        description: 'Nameservers to configure in your domain registrar',
        exportName: 'TodoNameServers',
      });
    }
  }
}
